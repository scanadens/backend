const express = require('express');
const pool = require('../db');
const { summarySelect, detailSelect } = require('../eventQueries');
const { optionalAuth, requireAuth, requireEventExec, parseId } = require('../middleware');
const { badRequest, notFound } = require('../errors');
const { validateEventFields } = require('../validateEvent');

const router = express.Router();

// GET /events — upcoming published events, soonest first
router.get('/', optionalAuth, async (req, res) => {
  const { search, category, club, from, to, free } = req.query;
  const params = [req.user?.id ?? null];
  const where = [`e.status = 'published'`];

  // Date range (default: from now on)
  if (from) {
    if (isNaN(Date.parse(from))) throw badRequest('from must be a date like 2026-12-01');
    params.push(from);
    where.push(`e.starts_at >= $${params.length}::timestamptz`);
  } else {
    where.push(`e.starts_at >= now()`);
  }
  if (to) {
    if (isNaN(Date.parse(to))) throw badRequest('to must be a date like 2026-12-31');
    params.push(to);
    where.push(`e.starts_at < ($${params.length}::date + 1)`); // include the whole "to" day
  }
  if (search && search.trim()) {
    params.push(`%${search.trim()}%`);
    const p = `$${params.length}`;
    where.push(`(e.title ILIKE ${p} OR e.description ILIKE ${p} OR e.location ILIKE ${p} OR c.name ILIKE ${p})`);
  }
  if (category) {
    params.push(parseId(category, 'category'));
    where.push(`e.category_id = $${params.length}`);
  }
  if (club) {
    params.push(club);
    where.push(`c.slug = $${params.length}`);
  }
  if (free === 'true') where.push(`e.price = 0`);

  const { rows } = await pool.query(
    `${summarySelect} WHERE ${where.join(' AND ')} ORDER BY e.starts_at LIMIT 200`, params);
  res.json({ data: rows });
});

// GET /events/:id — drafts are only visible to that club's execs
router.get('/:id', optionalAuth, async (req, res) => {
  const id = parseId(req.params.id, 'event id');
  const { rows } = await pool.query(`${detailSelect} WHERE e.id = $2`, [req.user?.id ?? null, id]);
  const event = rows[0];
  if (!event || (event.status === 'draft' && !event.can_edit)) throw notFound('Event not found');
  res.json(event);
});

// ---------- Student RSVPs ----------

// PUT /events/:id/rsvp  { status: "going" | "saved" } — create or update (safe to repeat)
router.put('/:id/rsvp', requireAuth, async (req, res) => {
  const eventId = parseId(req.params.id, 'event id');
  const status = req.body?.status ?? 'going';
  if (!['going', 'saved'].includes(status)) throw badRequest('status must be "going" or "saved"');

  const { rows } = await pool.query('SELECT status FROM events WHERE id = $1', [eventId]);
  if (!rows.length || rows[0].status === 'draft') throw notFound('Event not found');
  if (rows[0].status === 'cancelled') throw badRequest('This event has been cancelled');

  await pool.query(
    `INSERT INTO event_rsvps (user_id, event_id, status) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, event_id) DO UPDATE SET status = EXCLUDED.status`,
    [req.user.id, eventId, status]);
  const { rows: [count] } = await pool.query(
    `SELECT count(*)::int AS going_count FROM event_rsvps WHERE event_id = $1 AND status = 'going'`, [eventId]);
  res.json({ event_id: eventId, status, going_count: count.going_count });
});

// DELETE /events/:id/rsvp
router.delete('/:id/rsvp', requireAuth, async (req, res) => {
  const eventId = parseId(req.params.id, 'event id');
  await pool.query('DELETE FROM event_rsvps WHERE user_id = $1 AND event_id = $2', [req.user.id, eventId]);
  res.status(204).end();
});

// ---------- Exec actions on an existing event ----------

// PATCH /events/:id — send only the fields that change
router.patch('/:id', requireAuth, requireEventExec, async (req, res) => {
  const fields = validateEventFields(req.body, { partial: true });
  const keys = Object.keys(fields);
  if (!keys.length) throw badRequest('No fields to update');

  const sets = keys.map((k, i) => `${k} = $${i + 2}`);
  await pool.query(
    `UPDATE events SET ${sets.join(', ')}, updated_at = now() WHERE id = $1`,
    [req.event.id, ...keys.map((k) => fields[k])]);
  const { rows } = await pool.query(`${detailSelect} WHERE e.id = $2`, [req.user.id, req.event.id]);
  res.json(rows[0]);
});

// POST /events/:id/publish
router.post('/:id/publish', requireAuth, requireEventExec, async (req, res) => {
  if (req.event.status === 'cancelled') throw badRequest('Cancelled events cannot be published');
  await pool.query(
    `UPDATE events SET status = 'published', published_at = COALESCE(published_at, now()), updated_at = now()
     WHERE id = $1`, [req.event.id]);
  const { rows } = await pool.query(`${detailSelect} WHERE e.id = $2`, [req.user.id, req.event.id]);
  res.json(rows[0]);
});

// POST /events/:id/cancel
router.post('/:id/cancel', requireAuth, requireEventExec, async (req, res) => {
  await pool.query(`UPDATE events SET status = 'cancelled', updated_at = now() WHERE id = $1`, [req.event.id]);
  const { rows } = await pool.query(`${detailSelect} WHERE e.id = $2`, [req.user.id, req.event.id]);
  res.json(rows[0]);
});

// DELETE /events/:id — drafts only (published events should be cancelled instead)
router.delete('/:id', requireAuth, requireEventExec, async (req, res) => {
  if (req.event.status !== 'draft') throw badRequest('Only drafts can be deleted. Cancel published events instead.');
  await pool.query('DELETE FROM events WHERE id = $1', [req.event.id]);
  res.status(204).end();
});

// GET /events/:id/attendees
router.get('/:id/attendees', requireAuth, requireEventExec, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id AS user_id, u.first_name, u.last_name, u.email, r.status, r.created_at, r.checked_in_at
     FROM event_rsvps r JOIN users u ON u.id = r.user_id
     WHERE r.event_id = $1
     ORDER BY r.status, u.last_name, u.first_name`, [req.event.id]);
  res.json({ data: rows });
});

module.exports = router;
