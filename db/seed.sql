-- =====================================================================
-- Seed data for local development / testing
-- Run AFTER schema.sql:   psql "$DATABASE_URL" -f seed.sql
--
-- All test accounts use the password:  password123   (bcrypt hash below)
--   student@uwo.ca   -> regular student
--   exec@uwo.ca      -> owner of Western AI Society + executive of Board Games Club
--   exec2@uwo.ca     -> owner of Outdoors Club
--   admin@uwo.ca     -> platform admin
--
-- Clubs here are made-up sample data, not real club info.
-- To reset everything: drop the tables, re-run schema.sql, then this file.
-- =====================================================================

BEGIN;

-- ---------- Categories ----------
INSERT INTO categories (name) VALUES
  ('Tech'), ('Academic'), ('Social'), ('Sports & Fitness'),
  ('Arts & Culture'), ('Career'), ('Games'), ('Volunteering');

-- ---------- Users ----------
INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES
  ('student@uwo.ca', '$2b$10$elzSPZy3CDYSkksx9R/aMuDHo9Ls6ndJu21aUkihEAi4iQrZkRfhu', 'Sam',    'Student', 'student'),
  ('student2@uwo.ca','$2b$10$elzSPZy3CDYSkksx9R/aMuDHo9Ls6ndJu21aUkihEAi4iQrZkRfhu', 'Priya',  'Shah',    'student'),
  ('exec@uwo.ca',    '$2b$10$elzSPZy3CDYSkksx9R/aMuDHo9Ls6ndJu21aUkihEAi4iQrZkRfhu', 'Erin',   'Exec',    'student'),
  ('exec2@uwo.ca',   '$2b$10$elzSPZy3CDYSkksx9R/aMuDHo9Ls6ndJu21aUkihEAi4iQrZkRfhu', 'Marcus', 'Lee',     'student'),
  ('admin@uwo.ca',   '$2b$10$elzSPZy3CDYSkksx9R/aMuDHo9Ls6ndJu21aUkihEAi4iQrZkRfhu', 'Alex',   'Admin',   'admin');

-- ---------- Clubs ----------
INSERT INTO clubs (name, slug, description, contact_email, instagram_url) VALUES
  ('Western AI Society',   'western-ai',      'Workshops, speaker nights and projects on machine learning and AI.', 'ai.society@example.com',  'https://instagram.com/example_ai'),
  ('Board Games Club',     'board-games',     'Weekly game nights for every skill level. New players welcome!',      'boardgames@example.com', 'https://instagram.com/example_games'),
  ('Outdoors Club',        'outdoors',        'Hikes, paddling trips and outdoor skills around London, ON.',          'outdoors@example.com',   'https://instagram.com/example_outdoors'),
  ('Pre-Business Network', 'pre-business',    'Networking, case competitions and career prep for future business students.', 'prebiz@example.com', NULL),
  ('Film & Photo Society', 'film-photo',      'Screenings, photo walks and short-film workshops.',                    'filmphoto@example.com',  'https://instagram.com/example_film');

-- ---------- Club executives ----------
INSERT INTO club_executives (club_id, user_id, role)
SELECT c.id, u.id, x.role
FROM (VALUES
  ('western-ai',  'exec@uwo.ca',  'owner'),
  ('board-games', 'exec@uwo.ca',  'executive'),
  ('outdoors',    'exec2@uwo.ca', 'owner')
) AS x(slug, email, role)
JOIN clubs c ON c.slug = x.slug
JOIN users u ON u.email = x.email;

-- ---------- Events ----------
-- Times are Toronto local (-05). Includes drafts, a cancelled event and a past
-- event so you can test that students only see upcoming published events.
INSERT INTO events (club_id, created_by, category_id, title, description, starts_at, ends_at,
                    location, price, registration_url, poster_url, status, published_at)
SELECT c.id, u.id, cat.id, e.title, e.description, e.starts_at::timestamptz, e.ends_at::timestamptz,
       e.location, e.price, e.registration_url, e.poster_url, e.status,
       CASE WHEN e.status IN ('published','cancelled') THEN now() END
FROM (VALUES
  -- slug,        creator,        category,          title,                               description,                                                     starts_at,                ends_at,                  location,                      price,  registration_url,                        poster_url,                                status
  ('western-ai',  'exec@uwo.ca',  'Tech',            'Intro to Machine Learning Workshop', 'Hands-on beginner workshop. Bring a laptop; no experience needed.', '2026-11-25 18:00-05', '2026-11-25 20:00-05', 'Middlesex College 105',       0.00,  'https://example.com/register/ml-intro',  'https://placehold.co/600x800?text=ML+Workshop', 'published'),
  ('western-ai',  'exec@uwo.ca',  'Career',          'AI Careers Panel',                   'Alumni working in AI talk about internships and first jobs.',       '2026-12-02 17:30-05', '2026-12-02 19:00-05', 'UCC 56',                      0.00,  NULL,                                     'https://placehold.co/600x800?text=Careers+Panel', 'published'),
  ('western-ai',  'exec@uwo.ca',  'Tech',            'Winter Hackathon',                   '24-hour hackathon with prizes. Teams of up to 4.',                  '2027-01-23 09:00-05', '2027-01-24 09:00-05', 'Western Engineering Building', 10.00, 'https://example.com/register/hackathon', 'https://placehold.co/600x800?text=Hackathon', 'published'),
  ('western-ai',  'exec@uwo.ca',  'Tech',            'Prompt Engineering Night (DRAFT)',   'Still finalizing the speaker.',                                     '2027-02-05 18:00-05', NULL,                  NULL,                          0.00,  NULL,                                     NULL, 'draft'),
  ('board-games', 'exec@uwo.ca',  'Games',           'Weekly Game Night',                  'Catan, Codenames and more. Snacks provided.',                       '2026-11-20 19:00-05', '2026-11-20 22:00-05', 'UCC Room 315',                0.00,  NULL,                                     'https://placehold.co/600x800?text=Game+Night', 'published'),
  ('board-games', 'exec@uwo.ca',  'Games',           'End-of-Term Board Game Tournament',  'Bracket tournament, prizes for top 3.',                             '2026-12-05 13:00-05', '2026-12-05 18:00-05', 'Weldon Library Room 121',     5.00,  'https://example.com/register/tourney',   'https://placehold.co/600x800?text=Tournament', 'published'),
  ('board-games', 'exec@uwo.ca',  'Social',          'Games & Hot Chocolate',              'Cancelled due to room booking conflict.',                           '2026-11-27 19:00-05', '2026-11-27 21:00-05', 'UCC Room 315',                0.00,  NULL,                                     NULL, 'cancelled'),
  ('outdoors',    'exec2@uwo.ca', 'Sports & Fitness','Fall Hike at Komoka',                'Carpool from campus. Wear good boots!',                             '2026-11-22 10:00-05', '2026-11-22 15:00-05', 'Meet at UCC front entrance',  15.00, 'https://example.com/register/hike',      'https://placehold.co/600x800?text=Fall+Hike', 'published'),
  ('outdoors',    'exec2@uwo.ca', 'Sports & Fitness','Winter Camping Skills 101',          'Learn layering, stoves and snow shelters.',                         '2027-01-14 18:30-05', '2027-01-14 20:00-05', 'Thames Hall 2125',            0.00,  NULL,                                     'https://placehold.co/600x800?text=Winter+Skills', 'published'),
  ('outdoors',    'exec2@uwo.ca', 'Social',          'Season Kickoff Social (PAST)',       'Already happened - should NOT appear in upcoming events.',          '2026-09-15 18:00-05', '2026-09-15 20:00-05', 'The Spoke',                   0.00,  NULL,                                     NULL, 'published'),
  ('pre-business','admin@uwo.ca', 'Career',          'Resume Workshop',                    'Get your resume reviewed by upper-year students.',                  '2026-11-24 17:00-05', '2026-11-24 18:30-05', 'Social Science Centre 2050',  0.00,  NULL,                                     'https://placehold.co/600x800?text=Resume+Workshop', 'published'),
  ('pre-business','admin@uwo.ca', 'Career',          'Case Competition 2027',              'Teams of 4 solve a real business case. Cash prizes.',               '2027-01-30 09:00-05', '2027-01-30 17:00-05', 'UCC Centre Spot',             20.00, 'https://example.com/register/case',      'https://placehold.co/600x800?text=Case+Comp', 'published'),
  ('film-photo',  'admin@uwo.ca', 'Arts & Culture',  'Photo Walk: Campus at Night',        'Bring any camera - phones welcome.',                                '2026-11-26 18:00-05', '2026-11-26 20:00-05', 'Meet at Alumni Hall',         0.00,  NULL,                                     'https://placehold.co/600x800?text=Photo+Walk', 'published'),
  ('film-photo',  'admin@uwo.ca', 'Arts & Culture',  'Student Short Film Screening',       'Screening of member-made short films + Q&A.',                       '2026-12-04 19:00-05', '2026-12-04 21:30-05', 'Natural Sciences Centre 145', 3.50,  NULL,                                     'https://placehold.co/600x800?text=Screening', 'published')
) AS e(slug, creator, category, title, description, starts_at, ends_at, location, price, registration_url, poster_url, status)
JOIN clubs c       ON c.slug = e.slug
JOIN users u       ON u.email = e.creator
JOIN categories cat ON cat.name = e.category;

-- ---------- Student interests ----------
INSERT INTO user_interests (user_id, category_id)
SELECT u.id, cat.id
FROM (VALUES
  ('student@uwo.ca',  'Tech'), ('student@uwo.ca',  'Games'), ('student@uwo.ca', 'Career'),
  ('student2@uwo.ca', 'Arts & Culture'), ('student2@uwo.ca', 'Sports & Fitness')
) AS x(email, category)
JOIN users u        ON u.email = x.email
JOIN categories cat ON cat.name = x.category;

-- ---------- RSVPs ----------
INSERT INTO event_rsvps (user_id, event_id, status)
SELECT u.id, ev.id, x.status
FROM (VALUES
  ('student@uwo.ca',  'Intro to Machine Learning Workshop', 'going'),
  ('student@uwo.ca',  'Weekly Game Night',                  'going'),
  ('student@uwo.ca',  'Winter Hackathon',                   'saved'),
  ('student2@uwo.ca', 'Photo Walk: Campus at Night',        'going'),
  ('student2@uwo.ca', 'Intro to Machine Learning Workshop', 'saved')
) AS x(email, title, status)
JOIN users u   ON u.email = x.email
JOIN events ev ON ev.title = x.title;

COMMIT;
