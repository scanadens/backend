const express = require('express');
const cors = require('cors');
const pool = require('./db');
const { errorHandler, notFound } = require('./errors');
const { router: authRouter } = require('./routes/auth');

const app = express();

// CORS: set CORS_ORIGIN to your frontend URL(s), comma-separated. Unset = allow all (dev only).
const origins = process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors(origins?.length ? { origin: origins } : {}));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true });
});

app.use('/api/auth', authRouter);
app.use('/api/me', require('./routes/me'));
app.use('/api/events', require('./routes/events'));
app.use('/api/clubs', require('./routes/clubs'));

app.get('/api/categories', async (req, res) => {
  const { rows } = await pool.query('SELECT id, name FROM categories ORDER BY name');
  res.json({ data: rows });
});

app.use((req, res, next) => next(notFound(`No route for ${req.method} ${req.path}`)));
app.use(errorHandler);

module.exports = app;
