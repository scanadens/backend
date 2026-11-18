const jwt = require('jsonwebtoken');
const pool = require('./db');
const { unauthenticated, forbidden, notFound, badRequest } = require('./errors');

function readToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

// Sets req.user = { id, role } if a valid token is sent; otherwise req.user = null
function optionalAuth(req, res, next) {
  req.user = null;
  const token = readToken(req);
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.user = { id: payload.sub, role: payload.role };
    } catch {
      // Invalid/expired token on a public route: treat as logged out
    }
  }
  next();
}

// 401 unless a valid token is sent
function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) return next(unauthenticated());
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(unauthenticated('Your session has expired. Please log in again.'));
  }
}

function parseId(value, name = 'id') {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw badRequest(`Invalid ${name}`);
  return n;
}

async function isClubExec(userId, role, clubId) {
  if (role === 'admin') return true;
  const { rowCount } = await pool.query(
    'SELECT 1 FROM club_executives WHERE club_id = $1 AND user_id = $2', [clubId, userId]);
  return rowCount > 0;
}

// For /clubs/:id/... routes. Use after requireAuth.
async function requireClubExec(req, res, next) {
  const clubId = parseId(req.params.id, 'club id');
  const { rowCount } = await pool.query('SELECT 1 FROM clubs WHERE id = $1', [clubId]);
  if (!rowCount) throw notFound('Club not found');
  if (!(await isClubExec(req.user.id, req.user.role, clubId))) {
    throw forbidden('You are not an executive of this club');
  }
  req.clubId = clubId;
  next();
}

// For /events/:id/... routes. Looks up the event's club, then checks. Use after requireAuth.
async function requireEventExec(req, res, next) {
  const eventId = parseId(req.params.id, 'event id');
  const { rows } = await pool.query('SELECT id, club_id, status FROM events WHERE id = $1', [eventId]);
  if (!rows.length) throw notFound('Event not found');
  if (!(await isClubExec(req.user.id, req.user.role, rows[0].club_id))) {
    throw forbidden('You are not an executive of this club');
  }
  req.event = rows[0];
  next();
}

module.exports = { optionalAuth, requireAuth, requireClubExec, requireEventExec, parseId, isClubExec };
