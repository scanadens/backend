-- =====================================================================
-- Western Campus Events Platform — PostgreSQL schema (prototype)
-- Run with:  psql -d your_database -f schema.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. USERS — every account (students, club executives, platform admins)
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email          TEXT        NOT NULL,
    password_hash  TEXT        NOT NULL,              -- never store plain passwords
    first_name     TEXT        NOT NULL,
    last_name      TEXT        NOT NULL,
    role           TEXT        NOT NULL DEFAULT 'student'
                   CHECK (role IN ('student', 'admin')),  -- 'admin' = platform admin
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Case-insensitive unique email (Jane@uwo.ca and jane@uwo.ca are the same person)
CREATE UNIQUE INDEX users_email_unique ON users (lower(email));

-- ---------------------------------------------------------------------
-- 2. CLUBS — club profiles
-- ---------------------------------------------------------------------
CREATE TABLE clubs (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name           TEXT        NOT NULL UNIQUE,
    slug           TEXT        NOT NULL UNIQUE,       -- URL-friendly, e.g. 'western-ai'
    description    TEXT,
    logo_url       TEXT,
    contact_email  TEXT,
    instagram_url  TEXT,
    website_url    TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 3. CLUB_EXECUTIVES — which users can manage which clubs (many-to-many)
-- ---------------------------------------------------------------------
CREATE TABLE club_executives (
    club_id     BIGINT      NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        TEXT        NOT NULL DEFAULT 'executive'
                CHECK (role IN ('owner', 'executive')), -- owner can add/remove execs
    added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (club_id, user_id)                      -- no duplicate memberships
);
CREATE INDEX club_executives_user_idx ON club_executives (user_id);

-- ---------------------------------------------------------------------
-- 4. CATEGORIES — shared lookup list used by events AND student interests
-- ---------------------------------------------------------------------
CREATE TABLE categories (
    id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name  TEXT NOT NULL UNIQUE                          -- 'Tech', 'Sports', 'Social', ...
);

-- ---------------------------------------------------------------------
-- 5. EVENTS — the core table
-- ---------------------------------------------------------------------
CREATE TABLE events (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    club_id           BIGINT        NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    created_by        BIGINT        REFERENCES users(id) ON DELETE SET NULL,
    category_id       BIGINT        REFERENCES categories(id) ON DELETE SET NULL,
    title             TEXT          NOT NULL,
    description       TEXT,
    starts_at         TIMESTAMPTZ   NOT NULL,           -- date + time together
    ends_at           TIMESTAMPTZ,
    location          TEXT,                             -- e.g. 'UCC 56' or 'Online'
    price             NUMERIC(8,2)  NOT NULL DEFAULT 0 CHECK (price >= 0), -- 0 = free
    registration_url  TEXT,
    poster_url        TEXT,                             -- file lives in storage, URL here
    status            TEXT          NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'published', 'cancelled')),
    published_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX events_club_idx     ON events (club_id);
CREATE INDEX events_category_idx ON events (category_id);
CREATE INDEX events_starts_idx   ON events (starts_at) WHERE status = 'published';
-- Full-text search over title + description
CREATE INDEX events_search_idx ON events
    USING GIN (to_tsvector('english', title || ' ' || coalesce(description, '')));

-- ---------------------------------------------------------------------
-- 6. EVENT_RSVPS — students saving / registering for events (many-to-many)
-- ---------------------------------------------------------------------
CREATE TABLE event_rsvps (
    user_id        BIGINT      NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    event_id       BIGINT      NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    status         TEXT        NOT NULL DEFAULT 'going'
                   CHECK (status IN ('saved', 'going')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    checked_in_at  TIMESTAMPTZ,                         -- FUTURE: QR attendance
    PRIMARY KEY (user_id, event_id)                     -- can't RSVP twice
);
CREATE INDEX event_rsvps_event_idx ON event_rsvps (event_id);

-- ---------------------------------------------------------------------
-- 7. USER_INTERESTS — categories a student cares about (many-to-many)
-- ---------------------------------------------------------------------
CREATE TABLE user_interests (
    user_id      BIGINT NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
    category_id  BIGINT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, category_id)
);

-- ---------------------------------------------------------------------
-- 8. POSTER_EXTRACTIONS — AI poster uploads awaiting human review
-- ---------------------------------------------------------------------
CREATE TABLE poster_extractions (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    club_id         BIGINT      NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    uploaded_by     BIGINT      REFERENCES users(id)  ON DELETE SET NULL,
    event_id        BIGINT      REFERENCES events(id) ON DELETE SET NULL, -- draft created from it
    poster_url      TEXT        NOT NULL,
    status          TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'completed', 'failed')),
    extracted_data  JSONB,      -- raw AI output: {"title": ..., "starts_at": ..., ...}
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- FUTURE (not needed for the prototype) — uncomment when you build them
-- =====================================================================
-- CREATE TABLE notifications (
--     id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
--     user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     event_id    BIGINT REFERENCES events(id) ON DELETE CASCADE,
--     type        TEXT   NOT NULL,          -- 'reminder', 'event_updated', 'new_event_in_interest'
--     message     TEXT   NOT NULL,
--     read_at     TIMESTAMPTZ,
--     created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
-- );
--
-- QR attendance: add a per-RSVP secret code the QR encodes, then set checked_in_at on scan.
-- ALTER TABLE event_rsvps ADD COLUMN check_in_code UUID UNIQUE DEFAULT gen_random_uuid();
--
-- Club follows (students follow clubs for recommendations/notifications):
-- CREATE TABLE club_follows (
--     user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
--     club_id BIGINT REFERENCES clubs(id) ON DELETE CASCADE,
--     PRIMARY KEY (user_id, club_id)
-- );
