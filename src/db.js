const { Pool, types } = require('pg');

// Return BIGINT ids/counts and NUMERIC prices as JS numbers instead of strings
types.setTypeParser(20, (v) => parseInt(v, 10));   // int8
types.setTypeParser(1700, (v) => parseFloat(v));   // numeric

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Hosted Postgres (Supabase, Neon, Render) needs SSL
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

module.exports = pool;
