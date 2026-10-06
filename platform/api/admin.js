const crypto = require('crypto');
const SCHEMA = require('../lib/schema.js');

const { healthHeaders, inspectHealth } = require('../lib/sim-health.js');
const { present, FIELDS, statesOutcome } = require('../lib/catalogue.js');
const { sql, id } = require('../lib/db.js');
const A = require('../lib/auth.js');

function body(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
  return b || {};
}
const { baseUrl } = require('../lib/urls.js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const me = await A.requireRole(req, res, 'admin');
  if (!me) return;

  const b = body(req);
  const s = sql();

  try {
    switch (String(b.action || '')) {

      // Everything the admin dashboard shows in one call.
      case 'overview': {
        const faculty = await s`
          SELECT u.id, u.name, u.email, u.institution, u.created_at, u.last_seen_at, u.disabled,
                 u.password_hash IS NOT NULL AS accepted,
                 (SELECT count(*) FROM courses c WHERE c.faculty_id = u.id AND c.archived = false) AS courses,
                 (SELECT count(*) FROM enrolments e JOIN courses c ON c.id = e.course_id
                   WHERE c.faculty_id = u.id AND e.dropped = false) AS students,
                 (SELECT count(*) FROM enrolments e JOIN courses c ON c.id = e.course_id
                   WHERE c.faculty_id = u.id AND e.dropped = false AND e.paid = true) AS paid_students,
                 (SELECT string_agg(DISTINCT si.title, ', ' ORDER BY si.title)
                    FROM course_sims cs JOIN courses c ON c.id = cs.course_id
                    JOIN sims si ON si.id = cs.sim_id
                   WHERE c.faculty_id = u.id AND c.archived = false) AS sim_titles,
                 (SELECT string_agg(DISTINCT c.title, ', ' ORDER BY c.title)
                    FROM courses c WHERE c.faculty_id = u.id AND c.archived = false) AS course_titles,
                 (SELECT count(*) FROM launches l JOIN courses c ON c.id = l.course_id
                   WHERE c.faculty_id = u.id) AS launches
          FROM users u WHERE u.role = 'faculty' ORDER BY u.created_at DESC`;
        const simRows = await s`SELECT * FROM sims ORDER BY number NULLS LAST, created_at`;
        // Every simulation carries the copy the public page will show, so the
        // editor opens on real sentences rather than empty boxes.
        const sims = simRows.map(present);
        const totals = (await s`
          SELECT
            (SELECT count(*) FROM users WHERE role = 'student') AS students,
            (SELECT count(*) FROM courses WHERE archived = false) AS courses,
            (SELECT count(*) FROM enrolments WHERE paid = true AND dropped = false) AS paid_seats,
            (SELECT count(*) FROM launches) AS launches`)[0];
        return res.status(200).json({ faculty, sims, totals, baseUrl: baseUrl(req) });
      }

      // One faculty member, their courses, and who's in them.
      case 'faculty_detail': {
        const fid = String(b.facultyId || '');
        const person = (await s`SELECT id, name, email, institution, created_at, last_seen_at, disabled,
                                       password_hash IS NOT NULL AS accepted
                                FROM users WHERE id = ${fid} AND role = 'faculty'`)[0];
        if (!person) return res.status(404).json({ error: 'no_such_faculty' });
        const courses = await s`
          SELECT c.*,
            (SELECT count(*) FROM enrolments e WHERE e.course_id = c.id AND e.dropped = false) AS enrolled,
            (SELECT count(*) FROM enrolments e WHERE e.course_id = c.id AND e.dropped = false AND e.paid = true) AS paid
          FROM courses c WHERE c.faculty_id = ${fid} ORDER BY c.created_at DESC`;
        const students = await s`
          SELECT e.id AS enrolment_id, e.course_id, e.paid, e.paid_at, e.paid_note, e.dropped,
                 u.id AS student_id, u.name, u.email, u.last_seen_at,
                 (SELECT count(*) FROM launches l WHERE l.user_id = u.id AND l.course_id = e.course_id) AS launches
          FROM enrolments e
          JOIN users u ON u.id = e.student_id
          JOIN courses c ON c.id = e.course_id
          WHERE c.faculty_id = ${fid}
          ORDER BY u.name`;
        const courseSims = await s`
          SELECT cs.*, si.title FROM course_sims cs
          JOIN courses c ON c.id = cs.course_id
          JOIN sims si ON si.id = cs.sim_id
          WHERE c.faculty_id = ${fid}`;
        return res.status(200).json({ person, courses, students, courseSims });
      }

      // Creates the account and returns a one-time link to send by hand.
      // No email service involved.
      case 'invite_faculty': {
        const email = String(b.email || '').trim().toLowerCase();
        const name = String(b.name || '').trim();
        const institution = String(b.institution || '').trim() || null;
        if (!email || !name) return res.status(400).json({ error: 'need_name_and_email' });

        let uid;
        const existing = (await s`SELECT id, role FROM users WHERE email = ${email}`)[0];
        if (existing) {
          if (existing.role !== 'faculty') return res.status(409).json({ error: 'email_in_use', message: 'That email already belongs to a different kind of account.' });
          uid = existing.id;
        } else {
          uid = id('usr');
          await s`INSERT INTO users (id, email, name, role, institution)
                  VALUES (${uid}, ${email}, ${name}, 'faculty', ${institution})`;
        }

        const token = crypto.randomBytes(24).toString('base64url');
        const expires = new Date(Date.now() + 14 * 86400000);
        await s`INSERT INTO tokens (token, user_id, purpose, expires_at)
                VALUES (${token}, ${uid}, 'invite', ${expires})`;
        return res.status(200).json({
          facultyId: uid,
          inviteUrl: `${baseUrl(req)}/accept.html?t=${token}`,
          expiresAt: expires
        });
      }

      // Cancels any unused invitation for this person, so a link sent to the
      // wrong address stops working.
      case 'revoke_invites': {
        const uid = String(b.facultyId || '');
        const r = await s`UPDATE tokens SET used_at = now()
                          WHERE user_id = ${uid} AND purpose = 'invite' AND used_at IS NULL`;
        return res.status(200).json({ ok: true });
      }

      // Only for accounts that never got used. Anyone with courses should be
      // disabled instead, so their students' history survives.
      case 'delete_faculty': {
        const uid = String(b.facultyId || '');
        const person = (await s`SELECT id, name FROM users WHERE id = ${uid} AND role = 'faculty'`)[0];
        if (!person) return res.status(404).json({ error: 'no_such_faculty' });
        const courses = await s`SELECT id FROM courses WHERE faculty_id = ${uid}`;
        if (courses.length) {
          return res.status(409).json({ error: 'has_courses',
            message: `${person.name} has ${courses.length} course${courses.length === 1 ? '' : 's'}. Disable the account instead — deleting would take their students' history with it.` });
        }
        await s`DELETE FROM users WHERE id = ${uid}`;
        return res.status(200).json({ ok: true });
      }

      case 'set_faculty_disabled': {
        await s`UPDATE users SET disabled = ${!!b.disabled} WHERE id = ${String(b.facultyId || '')} AND role = 'faculty'`;
        return res.status(200).json({ ok: true });
      }

      // ---------- catalogue ----------

      // Ask a deployment what it is, rather than making someone remember.
      // Every sim answers at /api/health with its own id and what it has been
      // configured with, including a fingerprint of its launch secret — so this
      // also catches the misconfiguration that has bitten us twice: a sim that
      // will refuse every launch because its secret does not match ours.
      case 'probe_sim': {
        const raw = String(b.launchUrl || '').trim().replace(/\/+$/, '');
        if (!/^https?:\/\//.test(raw)) {
          return res.status(400).json({ error: 'bad_url', message: 'Give the full address, starting https://' });
        }
        let health;
        try {
          const r = await fetch(raw + '/api/health', { headers: healthHeaders(), signal: AbortSignal.timeout(8000) });
          if (!r.ok && r.status !== 503) return res.status(502).json({ error: 'no_health',
            message: `That address answered ${r.status}. Is it a simulation, and is it deployed?` });
          health = await r.json();
        } catch (e) {
          return res.status(502).json({ error: 'unreachable',
            message: 'Could not reach that address. Check it is deployed and the URL is right.' });
        }
        if (!health || !health.sim) {
          return res.status(502).json({ error: 'not_a_sim',
            message: 'That answered, but not like a simulation. Check the address.' });
        }

        const already = (await s`SELECT id, number, title FROM sims WHERE id = ${health.sim}`)[0] || null;
        const taken = (await s`SELECT number FROM sims WHERE number IS NOT NULL`).map(r => r.number);
        let suggested = 1;
        while (taken.includes(suggested)) suggested++;

        const { problems, state } = inspectHealth(health);

        return res.status(200).json({
          id: health.sim,
          launchUrl: raw,
          existing: already,
          healthState: state,
          suggestedNumber: already && already.number ? already.number : suggested,
          problems
        });
      }
      // The catalogue copy an administrator writes wins over what the
      // simulation sent about itself, and survives every later announcement.
      // Blanking a field hands it back to the simulation.
      // Throws away everything an administrator has written for one simulation,
      // so the next announcement refills it from the simulation itself. The way
      // out of copy that has gone stale without editing eight boxes by hand.
      case 'reset_detail': {
        const sid = String(b.id || '').trim();
        const row = (await s`SELECT launch_url FROM sims WHERE id = ${sid}`)[0];
        if (!row) return res.status(404).json({ error: 'no_such_sim' });
        // The tagline is copy too. Leaving it behind meant a reset produced a
        // page with a rewritten description under a sentence from three
        // versions ago.
        await s`UPDATE sims SET detail = NULL, description = NULL, tagline = NULL WHERE id = ${sid}`;
        // Ask it to describe itself again rather than waiting for a cold start.
        let refreshed = false;
        try {
          const r = await fetch(String(row.launch_url).replace(/\/+$/, '') + '/api/health',
            { headers: healthHeaders(), signal: AbortSignal.timeout(7000) });
          refreshed = r.ok;
        } catch (e) { /* it will announce itself next time it is used */ }
        return res.status(200).json({ ok: true, refreshed });
      }

      case 'catalogue_fields': {
        return res.status(200).json({ fields: FIELDS });
      }

      case 'save_detail': {
        const sid = String(b.id || '').trim();
        if (!sid) return res.status(400).json({ error: 'need_id' });
        const cur = (await s`SELECT detail FROM sims WHERE id = ${sid}`)[0];
        if (!cur) return res.status(404).json({ error: 'no_such_sim' });

        // Refuse copy that gives the simulation away. The page is read by people
        // deciding whether to teach with it, and a description that names the
        // ending removes the reason to.
        for (const f of FIELDS) {
          if (b[f.key] === undefined) continue;
          const told = statesOutcome(b[f.key]);
          if (told.length) return res.status(400).json({ error: 'states_outcome',
            message: `"${f.label}" gives the ending away — it says ${told.map(t => `"${t}"`).join(' and ')}. The catalogue is public.` });
        }

        // Two of these are columns of their own; the rest live in detail.
        if (b.tagline !== undefined) {
          const v = String(b.tagline).trim();
          await s`UPDATE sims SET tagline = ${v || null} WHERE id = ${sid}`;
        }
        if (b.description !== undefined) {
          const v = String(b.description).trim();
          await s`UPDATE sims SET description = ${v || null} WHERE id = ${sid}`;
        }
        const next = Object.assign({}, cur.detail || {});
        const words = FIELDS.map(f => f.key).filter(k => k !== 'description' && k !== 'tagline');
        for (const k of words) {
          if (b[k] === undefined) continue;
          const v = String(b[k]).trim();
          if (v) next[k] = v.slice(0, 2000); else delete next[k];
        }
        // Anything an administrator has touched is theirs from now on.
        next._edited = Array.from(new Set([...(cur.detail && cur.detail._edited || []),
          ...FIELDS.map(f => f.key).filter(k => b[k] !== undefined && String(b[k]).trim())]));

        await s`UPDATE sims SET detail = ${JSON.stringify(next).slice(0, 12000)} WHERE id = ${sid}`;
        return res.status(200).json({ ok: true, detail: next });
      }

      case 'save_sim': {
        const sid = String(b.id || '').trim();
        if (!sid) return res.status(400).json({ error: 'need_id' });
        const num = b.number === '' || b.number === undefined || b.number === null
          ? null : parseInt(b.number, 10);
        if (num !== null) {
          const clash = await s`SELECT id FROM sims WHERE number = ${num} AND id <> ${sid}`;
          if (clash.length) return res.status(409).json({ error: 'number_taken',
            message: `Number ${num} already belongs to ${clash[0].id}. Every simulation needs its own.` });
        }
        await s`
          INSERT INTO sims (id, number, title, tagline, description, minutes, launch_url, published)
          VALUES (${sid}, ${num}, ${String(b.title || '')}, ${b.tagline || null}, ${b.description || null},
                  ${b.minutes ? parseInt(b.minutes, 10) : null}, ${String(b.launchUrl || '')}, ${!!b.published})
          ON CONFLICT (id) DO UPDATE SET
            number = EXCLUDED.number,
            title = EXCLUDED.title, tagline = EXCLUDED.tagline, description = EXCLUDED.description,
            minutes = EXCLUDED.minutes, launch_url = EXCLUDED.launch_url, published = EXCLUDED.published`;
        // Once it's published, review grants mean nothing and would otherwise
        // accumulate as rows nobody reads.
        if (b.published) await s`DELETE FROM sim_access WHERE sim_id = ${sid}`;
        return res.status(200).json({ ok: true });
      }

      // Every course across every facilitator, for when the question is
      // "who is running what right now" rather than "how is Chuck doing".
      case 'all_courses': {
        const courses = await s`
          SELECT c.id, c.title, c.term, c.join_code, c.archived, c.created_at,
                 u.id AS faculty_id, u.name AS faculty_name, u.institution,
                 (SELECT count(*) FROM enrolments e WHERE e.course_id = c.id AND e.dropped = false) AS enrolled,
                 (SELECT count(*) FROM enrolments e WHERE e.course_id = c.id AND e.dropped = false AND e.paid = true) AS paid,
                 (SELECT count(*) FROM launches l WHERE l.course_id = c.id) AS launches,
                 (SELECT string_agg(si.title, ', ') FROM course_sims cs JOIN sims si ON si.id = cs.sim_id
                   WHERE cs.course_id = c.id) AS sim_titles
          FROM courses c JOIN users u ON u.id = c.faculty_id
          ORDER BY c.created_at DESC`;
        return res.status(200).json({ courses });
      }

      // No email service, so a reset is a link the admin hands over.
      case 'issue_reset': {
        const uid = String(b.userId || '');
        const person = (await s`SELECT id, name, email FROM users WHERE id = ${uid}`)[0];
        if (!person) return res.status(404).json({ error: 'no_such_user' });
        const token = crypto.randomBytes(24).toString('base64url');
        const expires = new Date(Date.now() + 3 * 86400000);
        await s`INSERT INTO tokens (token, user_id, purpose, expires_at)
                VALUES (${token}, ${uid}, 'reset', ${expires})`;
        return res.status(200).json({
          resetUrl: `${baseUrl(req)}/reset.html?t=${token}`,
          who: person.name, expiresAt: expires
        });
      }

      // Brings the database up to date after a release that adds tables or
      // indexes. Every statement is CREATE ... IF NOT EXISTS, so running it
      // repeatedly is harmless and it never drops anything.
      case 'migrate': {
        const runRaw = (text) => {
          if (typeof s.query === 'function') return s.query(text);
          const parts = [text]; parts.raw = [text];
          return s(parts);
        };
        let done = 0;
        for (const stmt of SCHEMA) { await runRaw(stmt); done++; }
        return res.status(200).json({ ok: true, statements: done });
      }

      // Wipes everything except administrators and the catalogue, so a pilot
      // can be run again from nothing. Guarded by typing the phrase out.
      case 'reset_test_data': {
        if (String(b.confirm || '') !== 'DELETE EVERYTHING') {
          return res.status(400).json({ error: 'not_confirmed',
            message: 'Type DELETE EVERYTHING exactly to confirm.' });
        }
        await s`DELETE FROM completions`;
        await s`DELETE FROM launches`;
        await s`DELETE FROM enrolments`;
        await s`DELETE FROM course_sims`;
        await s`DELETE FROM courses`;
        await s`DELETE FROM previews`;
        await s`DELETE FROM tokens WHERE user_id IN (SELECT id FROM users WHERE role <> 'admin')`;
        await s`DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE role <> 'admin')`;
        await s`DELETE FROM users WHERE role <> 'admin'`;
        return res.status(200).json({ ok: true });
      }

      case 'delete_sim': {
        const sid = String(b.simId || '');
        const used = await s`SELECT count(*)::int AS n FROM course_sims WHERE sim_id = ${sid}`;
        if (used[0] && used[0].n > 0 && !b.force) {
          return res.status(409).json({ error: 'in_use',
            message: `That simulation is in ${used[0].n} course${used[0].n === 1 ? '' : 's'}. Unpublish it instead, or confirm to remove it from them.` });
        }
        await s`DELETE FROM sims WHERE id = ${sid}`;
        return res.status(200).json({ ok: true });
      }

      // Every student, with where they are and what they have done. The counter
      // on the dashboard said two and there was nowhere to go and see who.
      case 'all_students': {
        const rows = await s`
          SELECT u.id, u.name, u.email, u.created_at, u.last_seen_at, u.disabled,
                 count(DISTINCT e.course_id) FILTER (WHERE e.dropped = false) AS courses,
                 count(DISTINCT e.course_id) FILTER (WHERE e.dropped = false AND e.paid = true) AS with_access,
                 count(DISTINCT l.id) AS launches,
                 count(DISTINCT c2.id) AS finished,
                 string_agg(DISTINCT co.title, ', ') AS course_titles,
                 string_agg(DISTINCT fac.name, ', ') AS faculty_names,
                 string_agg(DISTINCT si.title, ', ') AS sim_titles
          FROM users u
          LEFT JOIN enrolments e ON e.student_id = u.id
          LEFT JOIN courses co ON co.id = e.course_id AND e.dropped = false
          LEFT JOIN users fac ON fac.id = co.faculty_id
          LEFT JOIN course_sims cs ON cs.course_id = co.id
          LEFT JOIN sims si ON si.id = cs.sim_id
          LEFT JOIN launches l ON l.user_id = u.id
          LEFT JOIN completions c2 ON c2.user_id = u.id
          WHERE u.role = 'student'
          GROUP BY u.id, u.name, u.email, u.created_at, u.last_seen_at, u.disabled
          ORDER BY u.name`;
        return res.status(200).json({ students: rows });
      }

      // Correcting a mistyped email or name, rather than deleting and starting again.
      case 'update_person': {
        const uid = String(b.userId || '');
        const person = (await s`SELECT id, role FROM users WHERE id = ${uid}`)[0];
        if (!person) return res.status(404).json({ error: 'no_such_user' });
        if (person.role === 'admin') return res.status(403).json({ error: 'not_an_admin',
          message: 'Administrator accounts cannot be edited here.' });
        const name = String(b.name || '').trim();
        const email = String(b.email || '').trim().toLowerCase();
        if (email) {
          const clash = (await s`SELECT id FROM users WHERE email = ${email} AND id <> ${uid}`)[0];
          if (clash) return res.status(409).json({ error: 'email_taken',
            message: 'Another account already uses that email.' });
          await s`UPDATE users SET email = ${email} WHERE id = ${uid}`;
        }
        if (name) await s`UPDATE users SET name = ${name} WHERE id = ${uid}`;
        if (b.institution !== undefined) {
          await s`UPDATE users SET institution = ${String(b.institution).trim() || null} WHERE id = ${uid}`;
        }
        return res.status(200).json({ ok: true });
      }

      case 'delete_student': {
        const uid = String(b.userId || '');
        const person = (await s`SELECT id, name, role FROM users WHERE id = ${uid}`)[0];
        if (!person || person.role !== 'student') return res.status(404).json({ error: 'no_such_student' });
        const played = (await s`SELECT count(*)::int AS n FROM launches WHERE user_id = ${uid}`)[0];
        if (played && played.n > 0 && !b.force) {
          return res.status(409).json({ error: 'has_history',
            message: `${person.name} has opened simulations ${played.n} time${played.n === 1 ? '' : 's'}. Deleting takes that record with them — confirm if that is what you want.` });
        }
        await s`DELETE FROM users WHERE id = ${uid}`;
        return res.status(200).json({ ok: true });
      }

      // Re-asks every simulation we know about what it is, so a redeploy that
      // changed a title or moved to a new address is picked up without waiting
      // for somebody to open it. Also reports anything that has stopped
      // answering, which is how a dead deployment gets noticed before a class
      // rather than during one.
      case 'refresh_sims': {
        const sims = await s`SELECT id, title, launch_url FROM sims WHERE launch_url IS NOT NULL`;
        // Three deployments that can drift apart is the thing most likely to
        // waste an afternoon: everything answers, nothing is broken, and one of
        // them is running last week's code. So say plainly when they disagree.
        const ourBuild = process.env.VERCEL_GIT_COMMIT_SHA
          ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7) : null;
        const results = [];
        for (const sim of sims) {
          const base = String(sim.launch_url).replace(/\/+$/, '');
          try {
            const r = await fetch(base + '/api/health', {
              headers: healthHeaders(),
              signal: AbortSignal.timeout(7000) });
            if (!r.ok && r.status !== 503) { results.push({ id: sim.id, title: sim.title, state: 'unreachable',
              detail: `answered ${r.status}` }); continue; }
            const h = await r.json();
            const diagnosis = inspectHealth(h, sim);
            results.push({ id: sim.id, title: sim.title, build: h.build || null,
              state: diagnosis.state, detail: diagnosis.problems.join('; ') });
          } catch (e) {
            results.push({ id: sim.id, title: sim.title, state: 'unreachable',
              detail: 'did not answer' });
          }
        }
        return res.status(200).json({ results, ourBuild });
      }

      // ---------- pre-publication review ----------
      // Grants access, and creates the account if the person has none — a
      // reviewer is usually somebody being asked a favour, and making the
      // administrator invite them first and come back is a needless round trip.
      // There is no email service, so this hands back something to send.
      case 'grant_sim_access': {
        const simId = String(b.simId || '');
        const email = String(b.email || '').trim().toLowerCase();
        const sim = (await s`SELECT id, title, published FROM sims WHERE id = ${simId}`)[0];
        if (!sim) return res.status(404).json({ error: 'no_such_sim' });
        if (!email) return res.status(400).json({ error: 'need_email' });

        let person = (await s`SELECT id, name, role, password_hash FROM users WHERE email = ${email}`)[0];
        let inviteUrl = null;

        if (!person) {
          const uid = id('usr');
          const name = String(b.name || '').trim() || email.split('@')[0];
          await s`INSERT INTO users (id, email, name, role) VALUES (${uid}, ${email}, ${name}, 'faculty')`;
          person = { id: uid, name, role: 'faculty', password_hash: null };
        }
        if (person.role === 'student') return res.status(409).json({ error: 'is_a_student',
          message: 'That email belongs to a student. Review access is for facilitators.' });

        // Never used the account? They need a way in as well as the grant.
        if (!person.password_hash) {
          const token = crypto.randomBytes(24).toString('base64url');
          const expires = new Date(Date.now() + 14 * 86400000);
          await s`INSERT INTO tokens (token, user_id, purpose, expires_at)
                  VALUES (${token}, ${person.id}, 'invite', ${expires})`;
          inviteUrl = `${baseUrl(req)}/accept.html?t=${token}`;
        }

        await s`INSERT INTO sim_access (id, user_id, sim_id, granted_by, note)
                VALUES (${id('acc')}, ${person.id}, ${simId}, ${me.id}, ${String(b.note || '').trim() || null})
                ON CONFLICT (user_id, sim_id) DO UPDATE SET note = EXCLUDED.note, granted_by = EXCLUDED.granted_by`;

        return res.status(200).json({
          ok: true, who: person.name, email,
          simTitle: sim.title,
          inviteUrl,
          signInUrl: `${baseUrl(req)}/`,
          isNew: !!inviteUrl
        });
      }

      case 'revoke_sim_access': {
        await s`DELETE FROM sim_access WHERE id = ${String(b.grantId || '')}`;
        return res.status(200).json({ ok: true });
      }

      case 'sim_access_list': {
        // Two statements rather than one composed query — the neon driver's
        // tagged templates can't be nested.
        const simId = String(b.simId || '');
        const rows = simId
          ? await s`
              SELECT sa.id, sa.sim_id, sa.note, sa.created_at,
                     u.id AS user_id, u.name, u.email, u.role, g.name AS granted_by_name
              FROM sim_access sa
              JOIN users u ON u.id = sa.user_id
              LEFT JOIN users g ON g.id = sa.granted_by
              WHERE sa.sim_id = ${simId}
              ORDER BY sa.created_at DESC`
          : await s`
              SELECT sa.id, sa.sim_id, sa.note, sa.created_at,
                     u.id AS user_id, u.name, u.email, u.role, g.name AS granted_by_name
              FROM sim_access sa
              JOIN users u ON u.id = sa.user_id
              LEFT JOIN users g ON g.id = sa.granted_by
              ORDER BY sa.created_at DESC`;
        return res.status(200).json({ grants: rows });
      }

      default:
        return res.status(400).json({ error: 'unknown_action' });
    }
  } catch (e) {
    if (e.code === 'NO_DB') return res.status(503).json({ error: 'no_db' });
    console.error('admin failure', e.message);
    return res.status(500).json({ error: 'server_error', message: e.message });
  }
};
