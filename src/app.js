const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const cors = require('cors');
const pool = require('./db');
const { errorHandler, notFound, badRequest, forbidden } = require('./errors');
const { requireAuth } = require('./middleware');
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

// Poster images: bundled seed posters and exec uploads
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const EXT_BY_TYPE = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
app.use('/posters', express.static(path.join(__dirname, '..', 'public', 'posters')));
app.use('/uploads', express.static(UPLOAD_DIR));

// POST /api/uploads: raw image body (png/jpeg/webp, up to 8MB). Club execs and admins only.
app.post('/api/uploads', requireAuth, express.raw({ type: Object.keys(EXT_BY_TYPE), limit: '8mb' }),
  async (req, res) => {
    const ext = EXT_BY_TYPE[req.headers['content-type']?.split(';')[0]];
    if (!ext || !Buffer.isBuffer(req.body) || !req.body.length) {
      throw badRequest('Send a png, jpeg or webp image as the request body');
    }
    const { rowCount } = await pool.query(
      `SELECT 1 FROM club_executives WHERE user_id = $1 UNION SELECT 1 FROM users WHERE id = $1 AND role = 'admin'`,
      [req.user.id]);
    if (!rowCount) throw forbidden('Only club executives can upload posters');
    await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
    const name = `${crypto.randomUUID()}.${ext}`;
    await fs.promises.writeFile(path.join(UPLOAD_DIR, name), req.body);
    res.status(201).json({ url: `/uploads/${name}` });
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
