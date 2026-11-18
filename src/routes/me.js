const express = require('express');
const pool = require('../db');
const { summarySelect } = require('../eventQueries');
const { requireAuth } = require('../middleware');
const { badRequest, notFound } = require('../errors');
const { getUserWithClubs } = require('./auth');

const router = express.Router();
router.use(requireAuth);

// GET /me
router.get('/', async (req, res) => {
  const user = await getUserWithClubs(req.user.id);
  if (!user) throw notFound('User not found');
  res.json(user);
});

// GET /me/events?status=saved|going&when=upcoming|past
router.get('/events', async (req, res) => {
  const { status, when = 'upcoming' } = req.query;
  if (status && !['saved', 'going'].includes(status)) throw badRequest('status must be "saved" or "going"');
  if (!['upcoming', 'past'].includes(when)) throw badRequest('when must be "upcoming" or "past"');

  const params = [req.user.id];
  const where = [
    `EXISTS (SELECT 1 FROM event_rsvps mine WHERE mine.event_id = e.id AND mine.user_id = $1
             ${status ? `AND mine.status = $2` : ''})`,
    `e.status IN ('published', 'cancelled')`, // cancelled events stay visible so students know
    when === 'upcoming' ? `e.starts_at >= now()` : `e.starts_at < now()`,
  ];
  if (status) params.push(status);

  const { rows } = await pool.query(
    `${summarySelect} WHERE ${where.join(' AND ')}
     ORDER BY e.starts_at ${when === 'upcoming' ? 'ASC' : 'DESC'}`, params);
  res.json({ data: rows });
});

// GET /me/interests
router.get('/interests', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT cat.id, cat.name FROM user_interests ui JOIN categories cat ON cat.id = ui.category_id
     WHERE ui.user_id = $1 ORDER BY cat.name`, [req.user.id]);
  res.json({ data: rows });
});

// PUT /me/interests { category_ids: [1, 2] } — replaces the whole list
router.put('/interests', async (req, res) => {
  const ids = req.body?.category_ids;
  if (!Array.isArray(ids) || ids.some((x) => !Number.isInteger(x) || x <= 0)) {
    throw badRequest('category_ids must be an array of category ids');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM user_interests WHERE user_id = $1', [req.user.id]);
    if (ids.length) {
      await client.query(
        `INSERT INTO user_interests (user_id, category_id)
         SELECT $1, unnest($2::bigint[]) ON CONFLICT DO NOTHING`, [req.user.id, ids]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  const { rows } = await pool.query(
    `SELECT cat.id, cat.name FROM user_interests ui JOIN categories cat ON cat.id = ui.category_id
     WHERE ui.user_id = $1 ORDER BY cat.name`, [req.user.id]);
  res.json({ data: rows });
});

// GET /me/recommended — upcoming events in my interest categories I haven't RSVP'd to
router.get('/recommended', async (req, res) => {
  const { rows } = await pool.query(
    `${summarySelect}
     WHERE e.status = 'published' AND e.starts_at >= now()
       AND e.category_id IN (SELECT category_id FROM user_interests WHERE user_id = $1)
       AND NOT EXISTS (SELECT 1 FROM event_rsvps r WHERE r.event_id = e.id AND r.user_id = $1)
     ORDER BY e.starts_at LIMIT 20`, [req.user.id]);
  res.json({ data: rows });
});

module.exports = router;
