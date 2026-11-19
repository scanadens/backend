-- Keep Up seed: the ten Western club posters, with dates relative to today so the board is always fresh.
-- Runs after seed.sql. Replaces the placeholder events from seed.sql with the poster events.
-- Test logins (password123): student@uwo.ca, exec@uwo.ca (Computer Science, Western AI Society, Board Games Club).

BEGIN;

DELETE FROM events;  -- drop seed.sql's placeholder events (RSVPs/ratings cascade)

INSERT INTO clubs (name, slug, description) VALUES
  ('Computer Science',              'computer-science', 'Study jams, hack nights and career events for CS students.'),
  ('TCC',                           'tcc',              'Turkish Culture Club.'),
  ('Culture Clubs Collab',          'culture-collab',   'Nine culture clubs hosting events together.'),
  ('Western Cyber Society',         'cyber',            'Cybersecurity talks, CTFs and career nights.'),
  ('Western Aesthetics x UofT BBC', 'aesthetics',       'Lifting and fitness across two universities.'),
  ('HOSA Western',                  'hosa',             'Future health professionals.'),
  ('UWO Humanitarian Society',      'humanitarian',     'Volunteering and community service in London.'),
  ('WITS+',                         'wits',             'Women in science, tech and more.'),
  ('CAISA x Celsius',               'caisa',            'Sports and community events.'),
  ('WDS',                           'wds',              'Western Data Science: industry trips and workshops.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO club_executives (club_id, user_id, role)
SELECT c.id, u.id, 'owner' FROM clubs c, users u
WHERE c.slug = 'computer-science' AND u.email = 'exec@uwo.ca'
ON CONFLICT DO NOTHING;

-- 70 sample students so going counts and ratings are not zero.
INSERT INTO users (email, password_hash, first_name, last_name, role)
SELECT 'sample' || g || '@uwo.ca', (SELECT password_hash FROM users WHERE email = 'student@uwo.ca'),
       'Sample', 'Student ' || g, 'student'
FROM generate_series(1, 70) g;

WITH base AS (SELECT date_trunc('day', now() AT TIME ZONE 'America/Toronto') AS d)
INSERT INTO events (club_id, created_by, category_id, title, starts_at, ends_at, location, cost_label, time_label,
                    poster_url, status, published_at, sticker, why_go, solo_note, intents, tags)
SELECT c.id, (SELECT id FROM users WHERE email = 'exec@uwo.ca'), cat.id, e.title,
       ((b.d + (e.day || ' days')::interval + e.t::time) AT TIME ZONE 'America/Toronto'),
       CASE WHEN e.hours IS NULL THEN NULL
            ELSE ((b.d + (e.day || ' days')::interval + e.t::time + (e.hours || ' hours')::interval) AT TIME ZONE 'America/Toronto') END,
       e.location, e.cost_label, e.time_label, e.poster, 'published', now() - interval '1 day',
       e.sticker, e.why_go, e.solo_note, e.intents::text[], e.tags::text[]
FROM base b, (VALUES
  ('tcc','Social','Baklava Night',1,'19:00',2,'Stevenson Hall, Rm 1155','$5 members · $10 non-members',NULL,'/posters/p4.png',
   'Sticky hands make shy people brave.',
   'You make baklava, you take baklava home. Hands busy, phone away, and everyone around you is also figuring out the next layer. Easy to start talking when you are all covered in pistachio.',
   'Cooking side by side is a built-in conversation starter.',
   '{"Make stuff","Make friends"}','{food,cooking,culture,destress}'),
  ('culture-collab','Social','Euro Night at Delilah''s',5,'21:00',5,'Delilah''s · 19+ only','Discounted club tickets on Firstin',NULL,'/posters/p3.png',
   'Say yes to Sunday.',
   'Nine culture clubs, one disco ball. Come with a friend and you will probably leave with a few more. Club tickets are discounted, so your wallet gets a break too.',
   'Nine clubs mixing means there is always a group to join.',
   '{"Night out","Make friends"}','{party,music,cultural,dance}'),
  ('cyber','Career','Networking & Icebreakers',6,'18:00',2,'ACEB Atrium',NULL,NULL,'/posters/p7.png',
   'Awkward for 5 minutes. Useful for 5 years.',
   'Icebreakers, an internship and co-op panel, a live resume roast and mock interviews: the whole recruiting season in two hours. The icebreakers are the point, everyone starts a little awkward together.',
   'Icebreakers are literally on the schedule.',
   '{"Level up","Make friends"}','{career,cyber,networking,resume,interviews}'),
  ('aesthetics','Sports & Fitness','Collab Lift',12,'12:00',NULL,'Pure Muscle + Fitness, Burlington','$20 day pass',NULL,'/posters/p5.png',
   'Nobody''s judging your warm-up.',
   'A day at a new gym with lifters from two universities. Spots are limited, but you only have to show up. Chances are you leave with a spotter and a new gym buddy.',
   'An inter-university crew means plenty of new faces for everyone.',
   '{"Get moving","Make friends"}','{gym,fitness,lifting,collab}'),
  ('hosa','Career','Educator Session #2',-1,'19:00',2,'SSC 3022',NULL,NULL,'/posters/p8.png',
   'Curiosity counts as a qualification.',
   'Meet the execs, learn how to land a research position, then stay for board game night. Low pressure, with games to break the ice.',
   'Board game night makes starting conversations easy.',
   '{"Level up","Make friends"}','{health,research,networking,games}'),
  ('humanitarian','Volunteering','Dinner Service',-3,'16:00',3,'696 Dundas St','Free · 9 spots',NULL,'/posters/p10.png',
   'Small effort. Big plate.',
   'Butter bread, serve meals, and meet the people you are feeding. You leave tired in the best way, with a better story than "I studied".',
   'Everyone has a job, so you are never standing around.',
   '{"Give back","Make friends"}','{volunteering,community,food,service}'),
  ('wits','Academic','Explore the Stars',-7,'20:00',2,'UWO Cronyn Observatory',NULL,NULL,'/posters/p2.png',
   'Look up. Literally.',
   'Stargazing demos and constellation building under real telescopes. The kind of night you would never plan alone, and end up talking about for weeks.',
   'Hands-on activities give you something to talk about.',
   '{"Make stuff","Make friends"}','{astronomy,science,outdoors,creative}'),
  ('caisa','Sports & Fitness','CAISA Volleyball Tournament',-10,'17:20',6,'1137 Western Rd','$150 per team',NULL,'/posters/p9.png',
   'Be there. Being good is optional.',
   'Round up a team for an evening of volleyball with cash prizes on the line. Even if you have never spiked a ball, the team energy carries you.',
   'Best with a crew, so bring your floormates.',
   '{"Get moving","Make friends"}','{sports,volleyball,tournament,team}'),
  ('wds','Career','Firms Trip',-32,'09:00',NULL,'Downtown Toronto (RBC, Lyft)','$10','See poster for times','/posters/p6.png',
   'Doors open when you walk in.',
   'A behind-the-scenes look at RBC and Lyft in person. Ask the questions you would never ask on a careers page, and meet people two years ahead of you.',
   'Small group trips make it easy to meet people.',
   '{"Level up"}','{career,tech,finance,networking}')
) AS e(slug, category, title, day, t, hours, location, cost_label, time_label, poster, sticker, why_go, solo_note, intents, tags)
JOIN clubs c ON c.slug = e.slug
JOIN categories cat ON cat.name = e.category;

-- Going counts (sample students), matching the poster pitch: title -> how many go
INSERT INTO event_rsvps (user_id, event_id, status, checked_in_at)
SELECT u.id, ev.id, 'going',
       CASE WHEN ev.starts_at < now() AND (u.id % 4) <> 0 THEN ev.starts_at END
FROM (VALUES ('Baklava Night',22),('Euro Night at Delilah''s',63),('Networking & Icebreakers',40),('Collab Lift',12),
             ('Educator Session #2',27),('Dinner Service',9),('Explore the Stars',24),
             ('CAISA Volleyball Tournament',48),('Firms Trip',31)) AS g(title, n)
JOIN events ev ON ev.title = g.title
JOIN LATERAL (SELECT id FROM users WHERE email LIKE 'sample%@uwo.ca' ORDER BY id LIMIT g.n) u ON true;

-- Ratings from sample students on past events, so exec reports have real numbers
INSERT INTO event_ratings (user_id, event_id, rating)
SELECT r.user_id, r.event_id,
       CASE WHEN r.user_id % 10 < 6 THEN 'banger' WHEN r.user_id % 10 < 9 THEN 'fine' ELSE 'nope' END
FROM event_rsvps r JOIN events e ON e.id = r.event_id
WHERE e.starts_at < now() AND r.checked_in_at IS NOT NULL;

COMMIT;
