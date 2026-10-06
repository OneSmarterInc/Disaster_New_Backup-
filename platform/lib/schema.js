// Generated from schema.sql — kept as JavaScript so Vercel bundles it with the
// function. Edit schema.sql, then run `node lib/build-schema.js`.

module.exports = [
`CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  email          TEXT UNIQUE NOT NULL,
  name           TEXT NOT NULL,
  role           TEXT NOT NULL CHECK (role IN ('admin','faculty','student')),
  password_hash  TEXT,                       -- null until they accept an invite
  institution    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at   TIMESTAMPTZ,
  disabled       BOOLEAN NOT NULL DEFAULT false
)`,

`CREATE INDEX IF NOT EXISTS users_role_idx ON users(role)`,

`CREATE TABLE IF NOT EXISTS tokens (
  token       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose     TEXT NOT NULL CHECK (purpose IN ('invite','reset')),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ
)`,

`CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
)`,

`CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id)`,

`CREATE TABLE IF NOT EXISTS sims (
  id            TEXT PRIMARY KEY,
  number        INTEGER,            -- e.g. 'rapid-01-disaster'
  title         TEXT NOT NULL,
  tagline       TEXT,
  description   TEXT,
  minutes       INTEGER,
  launch_url    TEXT NOT NULL,               -- where a launch token is sent
  published     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
)`,

`CREATE TABLE IF NOT EXISTS previews (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sim_id      TEXT NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  UNIQUE (user_id, sim_id)
)`,

`CREATE TABLE IF NOT EXISTS courses (
  id            TEXT PRIMARY KEY,
  faculty_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  term          TEXT,
  join_code     TEXT UNIQUE NOT NULL,        -- what goes in the student link
  archived      BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
)`,

`CREATE INDEX IF NOT EXISTS courses_faculty_idx ON courses(faculty_id)`,

`CREATE TABLE IF NOT EXISTS course_sims (
  course_id      TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  sim_id         TEXT NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
  expected_seats INTEGER,
  hard_cap       BOOLEAN NOT NULL DEFAULT false,
  added_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (course_id, sim_id)
)`,

`CREATE TABLE IF NOT EXISTS enrolments (
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
)`,

`CREATE INDEX IF NOT EXISTS enrolments_course_idx ON enrolments(course_id)`,

`CREATE INDEX IF NOT EXISTS enrolments_student_idx ON enrolments(student_id)`,

`CREATE TABLE IF NOT EXISTS launches (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sim_id      TEXT NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
  course_id   TEXT REFERENCES courses(id) ON DELETE SET NULL,
  as_role     TEXT NOT NULL,                 -- 'student' | 'faculty_preview' | 'faculty'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
)`,

`CREATE INDEX IF NOT EXISTS launches_user_idx ON launches(user_id)`,

`CREATE INDEX IF NOT EXISTS launches_course_idx ON launches(course_id)`,

`CREATE TABLE IF NOT EXISTS completions (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sim_id           TEXT NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
  course_id        TEXT REFERENCES courses(id) ON DELETE SET NULL,
  completed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_seconds INTEGER,
  summary          TEXT,
  metrics          JSONB
)`,

`CREATE INDEX IF NOT EXISTS completions_user_idx ON completions(user_id)`,

`CREATE INDEX IF NOT EXISTS completions_course_idx ON completions(course_id)`,

`CREATE INDEX IF NOT EXISTS completions_sim_idx ON completions(sim_id)`,

`CREATE TABLE IF NOT EXISTS sim_access (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sim_id      TEXT NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
  granted_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, sim_id)
)`,

`CREATE INDEX IF NOT EXISTS sim_access_user_idx ON sim_access(user_id)`,

`CREATE INDEX IF NOT EXISTS sim_access_sim_idx ON sim_access(sim_id)`,

`ALTER TABLE sims ADD COLUMN IF NOT EXISTS number INTEGER`,

`CREATE UNIQUE INDEX IF NOT EXISTS sims_number_idx ON sims(number) WHERE number IS NOT NULL`,

`ALTER TABLE sims ADD COLUMN IF NOT EXISTS detail JSONB`,

`CREATE TABLE IF NOT EXISTS transcripts (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sim_id       TEXT NOT NULL REFERENCES sims(id) ON DELETE CASCADE,
  course_id    TEXT REFERENCES courses(id) ON DELETE SET NULL,
  sim_version  TEXT,                        -- read against the wrong version, a transcript misleads
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  envelope     JSONB NOT NULL
)`,

`CREATE INDEX IF NOT EXISTS transcripts_course_idx ON transcripts(course_id)`,

`CREATE INDEX IF NOT EXISTS transcripts_user_sim_idx ON transcripts(user_id, sim_id)`,
];
