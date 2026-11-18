# Campus Events — Backend

Node + Express + PostgreSQL. All endpoints are documented in **API.md**.

## Run it locally (5 minutes)

1. Install Node 18+.
2. Get a Postgres database. The easiest is a free one from **Neon** (neon.tech) or **Supabase**: create a project and copy the connection string.
3. In this folder:
   ```bash
   npm install
   cp .env.example .env        # then fill in DATABASE_URL and JWT_SECRET
   npm run db:setup            # creates tables + loads test data
   npm run dev                 # starts the API, restarts on file changes
   ```
4. Check it works: open http://localhost:4000/api/health. You should see `{"ok":true}`.
   Then try http://localhost:4000/api/events.

`npm run db:setup -- --reset` wipes the database and reloads the test data. Useful before the demo.

## Test accounts

All use the password `password123`:

| Email | Role |
|---|---|
| `student@uwo.ca` | Student with RSVPs + interests |
| `exec@uwo.ca` | Owner of Western AI Society, exec of Board Games Club |
| `exec2@uwo.ca` | Owner of Outdoors Club |
| `admin@uwo.ca` | Platform admin (can manage every club) |

## Deploy (Render, free tier)

1. Push the repo to GitHub.
2. On render.com: **New → Web Service**, then pick the repo.
   - Root directory: `backend` (or wherever this folder is)
   - Build command: `npm install`
   - Start command: `npm start`
3. Under **Environment**, add `DATABASE_URL`, `DATABASE_SSL=true`, `JWT_SECRET` and `CORS_ORIGIN` (your frontend URL, e.g. `https://yourapp.vercel.app`).
4. Give the frontend the URL: `https://<your-service>.onrender.com/api`

Free Render services sleep after inactivity, and the first request then takes about 30–50 seconds. Open `/api/health` a minute before you demo.

## Project layout

```
src/
  server.js          starts the app (reads .env)
  app.js             routes + middleware wiring
  db.js              Postgres connection pool
  middleware.js      auth (JWT) + "is this user an exec of this club?" checks
  errors.js          consistent { error: { code, message } } responses
  eventQueries.js    shared SQL for event responses
  validateEvent.js   checks event create/update bodies
  routes/
    auth.js          /api/auth/register, /api/auth/login
    me.js            /api/me, /api/me/events, /api/me/interests, /api/me/recommended
    events.js        /api/events (browse, detail, RSVP, exec edit/publish/cancel/delete/attendees)
    clubs.js         /api/clubs (list, profile, exec event list/create, profile edit)
db/
  schema.sql         tables
  seed.sql           test data
scripts/setup-db.js  runs schema + seed without needing psql
```

## How permissions work

- `requireAuth` means you need a valid `Authorization: Bearer <token>` header.
- `requireClubExec` / `requireEventExec` check the `club_executives` table. Admins pass automatically.
- Students only ever see `published` events. Drafts return 404 to anyone who isn't an exec of that club.
