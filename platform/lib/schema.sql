-- Flexee RapidSims platform.
-- Deliberately small: people, courses, enrolments, entitlement. No payment tables —
-- money is handled outside the system and lands here as a "paid" flag.

CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  email          TEXT UNIQUE NOT NULL,
  name           TEXT NOT NULL,
  role           TEXT NOT NULL CHECK (role IN ('admin','faculty','student')),
  password_hash  TEXT,                       -- null until they accept an invite
  institution    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at   TIMESTAMPTZ,
  disabled       BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);

-- One-time links: faculty invites and password resets.
CREATE TABLE IF NOT EXISTS tokens (
  token       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose     TEXT NOT NULL CHECK (purpose IN ('invite','reset')),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ
);

-- Login sessions. Cookie holds the id; nothing sensitive lives in the browser.
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

-- The catalogue. Each sim is its own deployment; the platform launches into it.
CREATE TABLE IF NOT EXISTS sims (
  id            TEXT PRIMARY KEY,
  number        INTEGER,            -- e.g. 'rapid-01-disaster'
  title         TEXT NOT NULL,
  tagline       TEXT,
  description   TEXT,
  minutes       INTEGER,
  launch_url    TEXT NOT NULL,               -- where a launch token is sent
  published     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A faculty member's seven-day look at a sim before committing to it.
CREATE TABLE IF NOT EXISTS previews (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sim_id      TEXT NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  UNIQUE (user_id, sim_id)
);

CREATE TABLE IF NOT EXISTS courses (
  id            TEXT PRIMARY KEY,
  faculty_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  term          TEXT,
  join_code     TEXT UNIQUE NOT NULL,        -- what goes in the student link
  archived      BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS courses_faculty_idx ON courses(faculty_id);

-- Which sims a course uses, and how many students the faculty expects.
CREATE TABLE IF NOT EXISTS course_sims (
  course_id      TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  sim_id         TEXT NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
  expected_seats INTEGER,
  hard_cap       BOOLEAN NOT NULL DEFAULT false,
  added_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (course_id, sim_id)
);

-- A student in a course. "paid" is the entitlement switch; without it they can
-- enrol and see the course but cannot launch a sim.
CREATE TABLE IF NOT EXISTS enrolments (
  id           TEXT PRIMARY KEY,
  course_id    TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  paid         BOOLEAN NOT NULL DEFAULT false,
  paid_at      TIMESTAMPTZ,
  paid_by      TEXT REFERENCES users(id),    -- which faculty marked it
  paid_note    TEXT,                          -- e.g. "dept PO 4471"
  dropped      BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, student_id)
);
CREATE INDEX IF NOT EXISTS enrolments_course_idx ON enrolments(course_id);
CREATE INDEX IF NOT EXISTS enrolments_student_idx ON enrolments(student_id);

-- Every launch, so admin can see real usage and faculty can see who has played.
CREATE TABLE IF NOT EXISTS launches (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sim_id      TEXT NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
  course_id   TEXT REFERENCES courses(id) ON DELETE SET NULL,
  as_role     TEXT NOT NULL,                 -- 'student' | 'faculty_preview' | 'faculty'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS launches_user_idx ON launches(user_id);
CREATE INDEX IF NOT EXISTS launches_course_idx ON launches(course_id);

-- Reported back by a sim when someone finishes it. The sim posts a signed
-- message; the platform stores it without knowing anything about the scenario.
-- metrics is whatever that sim chose to report, as label/value pairs.
CREATE TABLE IF NOT EXISTS completions (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sim_id           TEXT NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
  course_id        TEXT REFERENCES courses(id) ON DELETE SET NULL,
  completed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_seconds INTEGER,
  summary          TEXT,
  metrics          JSONB
);
CREATE INDEX IF NOT EXISTS completions_user_idx ON completions(user_id);
CREATE INDEX IF NOT EXISTS completions_course_idx ON completions(course_id);
CREATE INDEX IF NOT EXISTS completions_sim_idx ON completions(sim_id);

-- Lets a named person see an unpublished sim as though it were published, so a
-- new one can be reviewed through the platform rather than by handing out the
-- sim's own access code. No expiry: a trial expires because it is a trial, but
-- a review grant ends when the sim is published or an admin revokes it.
CREATE TABLE IF NOT EXISTS sim_access (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sim_id      TEXT NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
  granted_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, sim_id)
);
CREATE INDEX IF NOT EXISTS sim_access_user_idx ON sim_access(user_id);
CREATE INDEX IF NOT EXISTS sim_access_sim_idx ON sim_access(sim_id);


-- Added after the sims table existed, so it has to be an alter rather than part
-- of the create. Every simulation carries a short number people can say out
-- loud — 'RapidSim 2' rather than 'rapid-02-relay'. Names change, ids are
-- awkward in conversation, numbers are neither.
ALTER TABLE sims ADD COLUMN IF NOT EXISTS number INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS sims_number_idx ON sims(number) WHERE number IS NOT NULL;

-- The shop-window copy for a simulation: what makes it hard, who is in the
-- room, how the moments go. Supplied by the simulation itself when it
-- registers, because a new one should arrive with its own description rather
-- than waiting for somebody to write one.
ALTER TABLE sims ADD COLUMN IF NOT EXISTS detail JSONB;
-- Instructor transcripts.
--
-- Separate from completions on purpose. A completion is a signed summary —
-- twelve metrics, four hundred characters — and that cap is deliberate: the
-- platform learns that someone finished and nothing about the scenario. A
-- transcript is the opposite shape, a few dozen events a faculty member reads
-- once during a debrief, so it gets its own table rather than stretching a
-- column that was sized to refuse it.
--
-- The envelope is opaque here. The platform stores it, scopes it, and renders
-- it using vocabulary the sim itself supplied. It still never interprets what
-- any of it means, which is what keeps sims independent deployments.

CREATE TABLE IF NOT EXISTS transcripts (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sim_id       TEXT NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
  course_id    TEXT REFERENCES courses(id) ON DELETE SET NULL,
  sim_version  TEXT,                        -- read against the wrong version, a transcript misleads
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  envelope     JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS transcripts_course_idx ON transcripts(course_id);
CREATE INDEX IF NOT EXISTS transcripts_user_sim_idx ON transcripts(user_id, sim_id);

-- Retention. A transcript holds what a student typed, which is the most
-- identifying content the platform stores anywhere and the reason it is useful
-- in a debrief. Nothing here expires automatically; deletion is an explicit
-- act, either per course or by an admin, so that a policy decision is never
-- made by a default nobody chose.
