const express = require('express');
const pool = require('../db');
const { summarySelect, detailSelect } = require('../eventQueries');
const { optionalAuth, requireAuth, requireClubExec, isClubExec } = require('../middleware');
const { notFound, badRequest } = require('../errors');
const { validateEventFields } = require('../validateEvent');

const router = express.Router();

// GET /clubs
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.id, c.name, c.slug, c.logo_url, c.description,
            (SELECT count(*)::int FROM events e
               WHERE e.club_id = c.id AND e.status = 'published' AND e.starts_at >= now()) AS upcoming_event_count
     FROM clubs c ORDER BY c.name`);
  res.json({ data: rows });
});

// GET /clubs/:slug — profile + upcoming events
router.get('/:slug', optionalAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, slug, description, logo_url, contact_email, instagram_url, website_url
     FROM clubs WHERE slug = $1`, [req.params.slug]);
  const club = rows[0];
  if (!club) throw notFound('Club not found');

  const { rows: events } = await pool.query(
    `${summarySelect}
     WHERE e.club_id = $2 AND e.status = 'published' AND e.starts_at >= now()
     ORDER BY e.starts_at`, [req.user?.id ?? null, club.id]);

  club.upcoming_events = events;
  club.can_manage = req.user ? await isClubExec(req.user.id, req.user.role, club.id) : false;
  res.json(club);
});

// ---------- Exec: manage a club's events ----------

// GET /clubs/:id/events — ALL of the club's events (drafts, published, cancelled, past)
router.get('/:id/events', requireAuth, requireClubExec, async (req, res) => {
  const { rows } = await pool.query(
    `${summarySelect} WHERE e.club_id = $2
     ORDER BY CASE e.status WHEN 'draft' THEN 0 ELSE 1 END, e.starts_at DESC`,
    [req.user.id, req.clubId]);
  res.json({ data: rows });
});

// POST /clubs/:id/events — creates a DRAFT
router.post('/:id/events', requireAuth, requireClubExec, async (req, res) => {
  const f = validateEventFields(req.body, { partial: false });
  const columns = ['club_id', 'created_by', ...Object.keys(f)];
  const values = [req.clubId, req.user.id, ...Object.values(f)];
  const { rows: [created] } = await pool.query(
    `INSERT INTO events (${columns.join(', ')}, status)
     VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')}, 'draft') RETURNING id`, values);
  const { rows } = await pool.query(`${detailSelect} WHERE e.id = $2`, [req.user.id, created.id]);
  res.status(201).json(rows[0]);
});

// PATCH /clubs/:id — update club profile
router.patch('/:id', requireAuth, requireClubExec, async (req, res) => {
  const allowed = ['name', 'description', 'logo_url', 'contact_email', 'instagram_url', 'website_url'];
  const body = req.body || {};
  const keys = allowed.filter((k) => k in body);
  if (!keys.length) throw badRequest('No fields to update');
  for (const k of keys) {
    if (body[k] !== null && typeof body[k] !== 'string') throw badRequest(`${k} must be text`);
  }
  if ('name' in body && !body.name?.trim()) throw badRequest('name cannot be empty');
  await pool.query(
    `UPDATE clubs SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`,
    [req.clubId, ...keys.map((k) => (body[k] === '' ? null : body[k]))]);
  const { rows } = await pool.query(
    `SELECT id, name, slug, description, logo_url, contact_email, instagram_url, website_url
     FROM clubs WHERE id = $1`, [req.clubId]);
  res.json(rows[0]);
});

module.exports = router;
