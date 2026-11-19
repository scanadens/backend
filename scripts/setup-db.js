// Creates the tables and loads test data — no psql needed.
//   npm run db:setup            -> create tables + load seed data (empty database)
//   npm run db:setup -- --reset -> DROP everything first, then recreate (deletes all data!)
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const pool = require('../src/db');

(async () => {
  const reset = process.argv.includes('--reset');
  if (reset) {
    console.log('Dropping existing tables...');
    await pool.query(`DROP TABLE IF EXISTS poster_extractions, event_ratings, user_interests, event_rsvps, events,
                      categories, club_executives, clubs, users CASCADE`);
  }
  for (const file of ['schema.sql', 'seed.sql', 'seed_keepup.sql']) {
    console.log(`Running db/${file}...`);
    await pool.query(fs.readFileSync(path.join(__dirname, '..', 'db', file), 'utf8'));
  }
  console.log('Done. Test logins: student@uwo.ca / exec@uwo.ca / exec2@uwo.ca / admin@uwo.ca — password: password123');
  await pool.end();
})().catch(async (err) => {
  console.error('Setup failed:', err.message);
  if (err.code === '42P07') console.error('Tables already exist. Use: npm run db:setup -- --reset');
  await pool.end();
  process.exit(1);
});
