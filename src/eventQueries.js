// Shared SQL for returning events in the shapes defined in API.md.
// $1 is always the current user's id (or NULL when logged out).

const SUMMARY_COLUMNS = `
  e.id, e.title, e.starts_at, e.ends_at, e.location, e.price, e.poster_url, e.status,
  json_build_object('id', c.id, 'name', c.name, 'slug', c.slug) AS club,
  CASE WHEN cat.id IS NULL THEN NULL
       ELSE json_build_object('id', cat.id, 'name', cat.name) END AS category,
  (SELECT count(*)::int FROM event_rsvps r
     WHERE r.event_id = e.id AND r.status = 'going') AS going_count,
  (SELECT r.status FROM event_rsvps r
     WHERE r.event_id = e.id AND r.user_id = $1) AS my_rsvp`;

const DETAIL_COLUMNS = `${SUMMARY_COLUMNS},
  e.description, e.registration_url, e.created_at, e.updated_at,
  ( EXISTS (SELECT 1 FROM club_executives x WHERE x.club_id = e.club_id AND x.user_id = $1)
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = $1 AND u.role = 'admin') ) AS can_edit`;

const FROM = `
  FROM events e
  JOIN clubs c ON c.id = e.club_id
  LEFT JOIN categories cat ON cat.id = e.category_id`;

const summarySelect = `SELECT ${SUMMARY_COLUMNS} ${FROM}`;
const detailSelect = `SELECT ${DETAIL_COLUMNS} ${FROM}`;

module.exports = { summarySelect, detailSelect };
