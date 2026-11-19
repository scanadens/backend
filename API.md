# Campus Events API — v1 (implemented)

This is the **agreement between frontend and backend**. Frontend: build against these shapes using mock JSON. Backend: return exactly these shapes. If something needs to change, update this file in a PR so everyone sees it.

**Every endpoint below is built and tested** (the 🟢/🟡/⚪ marks are just original priority). No AI/Instagram endpoints in this version.

---

## Conventions

- **Base URL (local):** `http://localhost:4000/api`
- **Format:** JSON in, JSON out. Field names are `snake_case` and match the database columns.
- **Dates:** responses are ISO 8601 in UTC, e.g. `"2026-11-25T23:00:00.000Z"` (= 6 PM Toronto). Use `new Date(x).toLocaleString('en-CA', { timeZone: 'America/Toronto' })` to display. When sending, include the offset: `"2026-11-25T18:00:00-05:00"`.
- **Price:** number in dollars. `0` = free (show "Free").
- **IDs:** numbers.
- **Auth:** after login, send `Authorization: Bearer <token>` on every request that needs it.
  - 🔓 = public · 🔑 = logged in · 🛠️ = logged in **and** an executive of that club · 👑 = platform admin
- **Lists** return `{ "data": [...] }` so we can add pagination later without breaking anything.

### Error format (every error)

```json
{ "error": { "code": "NOT_FOUND", "message": "Event not found" } }
```

| Status | `code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Missing/invalid fields (`message` says which) |
| 401 | `UNAUTHENTICATED` | No token, or token expired |
| 403 | `FORBIDDEN` | Logged in but not allowed (e.g. not an exec of this club) |
| 404 | `NOT_FOUND` | Doesn't exist (or is a draft the user can't see) |
| 409 | `CONFLICT` | Duplicate (e.g. email already registered) |
| 500 | `SERVER_ERROR` | Bug on our side — tell the backend dev |

---

## Shared shapes

**`EventSummary`** — used in lists and cards

```json
{
  "id": 7,
  "title": "Intro to Machine Learning Workshop",
  "starts_at": "2026-11-25T18:00:00-05:00",
  "ends_at": "2026-11-25T20:00:00-05:00",
  "location": "Middlesex College 105",
  "price": 0,
  "poster_url": "https://placehold.co/600x800?text=ML+Workshop",
  "status": "published",
  "club": { "id": 1, "name": "Western AI Society", "slug": "western-ai" },
  "category": { "id": 1, "name": "Tech" },
  "going_count": 1,
  "my_rsvp": "going"
}
```

`my_rsvp` is `"saved"`, `"going"` or `null`. It's always `null` when not logged in.

**`EventDetail`** = `EventSummary` plus:

```json
{
  "description": "Hands-on beginner workshop. Bring a laptop; no experience needed.",
  "registration_url": "https://example.com/register/ml-intro",
  "created_at": "2026-11-16T20:00:00Z",
  "updated_at": "2026-11-16T20:00:00Z",
  "can_edit": false
}
```

`can_edit` is `true` if the current user is an exec of this event's club. Frontend uses it to show the Edit button.

**`User`**

```json
{ "id": 1, "email": "student@uwo.ca", "first_name": "Sam", "last_name": "Student", "role": "student",
  "clubs": [ { "id": 1, "name": "Western AI Society", "slug": "western-ai", "exec_role": "owner" } ] }
```

`clubs` = clubs this user is an executive of (empty array for most students). Frontend uses it to show the "Manage club" menu.

---

## Auth

### 🟢 `POST /auth/register` 🔓
```json
// request
{ "email": "new@uwo.ca", "password": "atleast8chars", "first_name": "Jo", "last_name": "Doe" }
// 201 response
{ "token": "eyJ...", "user": { ...User } }
```
Errors: `400` (password < 8 chars, bad email), `409` (email taken).

### 🟢 `POST /auth/login` 🔓
```json
// request
{ "email": "student@uwo.ca", "password": "password123" }
// 200 response
{ "token": "eyJ...", "user": { ...User } }
```
Errors: `401` with message "Invalid email or password". Use the same message whether the email or the password is wrong.

### 🟢 `GET /me` 🔑
Returns `{ ...User }`. Frontend calls this on page load to check if the stored token is still valid.

---

## Events (browsing)

### 🟢 `GET /events` 🔓 (🔑 optional — fills in `my_rsvp`)
Upcoming **published** events, soonest first.

| Query param | Example | Meaning |
|---|---|---|
| `search` | `machine learning` | Matches title + description |
| `category` | `1` | Category id |
| `club` | `western-ai` | Club slug |
| `from` / `to` | `2026-12-01` | Date range (defaults: from = now, to = none) |
| `free` | `true` | Only price = 0 |

```json
{ "data": [ { ...EventSummary }, ... ] }
```

### 🟢 `GET /events/:id` 🔓
Returns `{ ...EventDetail }`. `404` if the event doesn't exist, **or** if it's a draft and the user isn't an exec of that club.

### 🟢 `GET /categories` 🔓
```json
{ "data": [ { "id": 1, "name": "Tech" }, { "id": 2, "name": "Academic" } ] }
```

---

## Clubs

### 🟢 `GET /clubs` 🔓
```json
{ "data": [ { "id": 1, "name": "Western AI Society", "slug": "western-ai", "logo_url": null, "description": "...", "upcoming_event_count": 2 } ] }
```

### 🟢 `GET /clubs/:slug` 🔓
```json
{
  "id": 1, "name": "Western AI Society", "slug": "western-ai",
  "description": "...", "logo_url": null, "contact_email": "...", "instagram_url": "...", "website_url": null,
  "upcoming_events": [ { ...EventSummary } ],
  "can_manage": false
}
```

### 🟡 `PATCH /clubs/:id` 🛠️
Update club profile. Send only the fields that are changing. Returns the updated club.

> Adding executives and creating clubs are **not built** — they come from the seed data.

---

## Student actions

### 🟡 `PUT /events/:id/rsvp` 🔑
Creates or updates the user's RSVP. Calling it twice is safe; it just updates the status.
```json
// request
{ "status": "going" }      // or "saved"
// 200 response
{ "event_id": 7, "status": "going", "going_count": 2 }
```

### 🟡 `DELETE /events/:id/rsvp` 🔑
Removes the RSVP. Returns `204` (no body).

### 🟡 `GET /me/events` 🔑
The user's saved and going events, for "My Schedule". Includes cancelled events (check `status`).

| Query param | Values |
|---|---|
| `status` | `saved`, `going` (omit for both) |
| `when` | `upcoming` (default), `past` |

```json
{ "data": [ { ...EventSummary } ] }
```

### 🟡 `GET /me/interests` 🔑 · `PUT /me/interests` 🔑
```json
// PUT request: replaces the whole list
{ "category_ids": [1, 6, 7] }
// response (both)
{ "data": [ { "id": 1, "name": "Tech" }, { "id": 6, "name": "Career" }, { "id": 7, "name": "Games" } ] }
```

### ⚪ `GET /me/recommended` 🔑
Upcoming events in the user's interest categories, excluding events they've already RSVP'd to. Returns `{ "data": [ ...EventSummary ] }`.

---

## Executive: managing events

### 🟡 `GET /clubs/:id/events` 🛠️
All of the club's events **including drafts and cancelled**, for the club dashboard.

### 🟡 `POST /clubs/:id/events` 🛠️
Creates the event as a **draft**.
```json
// request
{
  "title": "Winter Hackathon",            // required
  "starts_at": "2027-01-23T09:00:00-05:00", // required
  "ends_at": "2027-01-24T09:00:00-05:00",
  "description": "...", "location": "...", "price": 10,
  "category_id": 1, "registration_url": "...", "poster_url": "..."
}
// 201 response
{ ...EventDetail, "status": "draft" }
```

### 🟡 `PATCH /events/:id` 🛠️
Send only the changed fields. Returns `{ ...EventDetail }`.

### 🟡 `POST /events/:id/publish` 🛠️
Sets the status to `published`. Returns `{ ...EventDetail }`.

### 🟡 `POST /events/:id/cancel` 🛠️
Sets the status to `cancelled`. Returns `{ ...EventDetail }`. Cancelled events disappear from `GET /events` but stay in the RSVP'd students' `GET /me/events` with `status: "cancelled"`. New RSVPs to them return `400`.

### ⚪ `DELETE /events/:id` 🛠️
Only allowed for drafts. Published events should be cancelled instead, so RSVPs aren't silently lost.

### 🟡 `GET /events/:id/attendees` 🛠️
```json
{ "data": [ { "user_id": 1, "first_name": "Sam", "last_name": "Student", "email": "student@uwo.ca", "status": "going", "created_at": "...", "checked_in_at": null } ] }
```

---

## Test accounts (from `backend/db/seed.sql`)

All passwords are `password123`.

| Email | Use it to test |
|---|---|
| `student@uwo.ca` | Regular student, has RSVPs + interests |
| `exec@uwo.ca` | Owner of Western AI Society, exec of Board Games Club |
| `exec2@uwo.ca` | Owner of Outdoors Club (should be **blocked** from editing Western AI events) |
| `admin@uwo.ca` | Platform admin |

The seed data also includes a **draft**, a **cancelled** event and a **past** event. None of them should appear in `GET /events`.

---

## Keep Up additions

Added for the Keep Up frontend. Everything above still applies.

**New event fields** (returned on every `EventSummary`, accepted on create/PATCH): `sticker` (≤80), `why_go` (≤400), `solo_note` (≤200), `intents` (any of `Make friends`, `Level up`, `Get moving`, `Make stuff`, `Give back`, `Night out`), `tags` (≤12 short words), `cost_label`, `time_label`.

| Endpoint | Who | What |
|---|---|---|
| `PUT /events/:id/rating` `{ "rating": "banger" \| "fine" \| "nope" \| "skipped" }` | 🔑 | Rate a past event (time capsule). Future events return `400`. |
| `DELETE /events/:id/rating` | 🔑 | Remove my rating. `204`. |
| `GET /me/ratings` | 🔑 | `{ "data": [ { "event_id": 7, "rating": "banger" } ] }` |
| `GET /events/:id/report` | 🛠️ | `{ rsvps, going, showed_up, first_timers, banger, fine, nope }` |
| `POST /uploads` | 🛠️ any club | Raw `image/png`, `image/jpeg` or `image/webp` body (≤8 MB). Returns `{ "url": "/uploads/<id>.png" }`. Use it as `poster_url`. |
| `GET /posters/*`, `GET /uploads/*` | 🔓 | Static poster images (not under `/api`). Poster paths starting with `/` live on the API origin. |

**Pinning** in the app is `PUT /events/:id/rsvp` with `"going"`. Past events: `GET /events?from=2020-01-01`.

`npm run db:setup -- --reset` now also loads `db/seed_keepup.sql`: the ten Western posters with the dates printed on them, 70 sample students for going counts, and sample ratings. It replaces the placeholder events from `seed.sql`.
