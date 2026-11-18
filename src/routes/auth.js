const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { badRequest, unauthenticated, conflict } = require('../errors');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function makeToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// User object as described in API.md (includes clubs the user is an exec of)
async function getUserWithClubs(userId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.role,
            COALESCE(json_agg(json_build_object('id', c.id, 'name', c.name, 'slug', c.slug, 'exec_role', x.role)
                              ORDER BY c.name) FILTER (WHERE c.id IS NOT NULL), '[]') AS clubs
     FROM users u
     LEFT JOIN club_executives x ON x.user_id = u.id
     LEFT JOIN clubs c ON c.id = x.club_id
     WHERE u.id = $1
     GROUP BY u.id`, [userId]);
  return rows[0] || null;
}

router.post('/register', async (req, res) => {
  const { email, password, first_name, last_name } = req.body || {};
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) throw badRequest('A valid email is required');
  if (typeof password !== 'string' || password.length < 8) throw badRequest('Password must be at least 8 characters');
  if (typeof first_name !== 'string' || !first_name.trim()) throw badRequest('first_name is required');
  if (typeof last_name !== 'string' || !last_name.trim()) throw badRequest('last_name is required');

  const hash = await bcrypt.hash(password, 10);
  let user;
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name)
       VALUES ($1, $2, $3, $4) RETURNING id, role`,
      [email.trim().toLowerCase(), hash, first_name.trim(), last_name.trim()]);
    user = rows[0];
  } catch (err) {
    if (err.code === '23505') throw conflict('An account with this email already exists');
    throw err;
  }
  res.status(201).json({ token: makeToken(user), user: await getUserWithClubs(user.id) });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string') throw badRequest('email and password are required');

  const { rows } = await pool.query(
    'SELECT id, role, password_hash FROM users WHERE lower(email) = lower($1)', [email.trim()]);
  const user = rows[0];
  // Same message whether the email or the password is wrong
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw unauthenticated('Invalid email or password');
  }
  res.json({ token: makeToken(user), user: await getUserWithClubs(user.id) });
});

module.exports = { router, getUserWithClubs };
