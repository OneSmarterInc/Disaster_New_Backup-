const { META } = require('./meta.js');

function accountJoinUrl(sess) {
  const base = (process.env.PLATFORM_URL || 'https://rapidsims.flexee.org').replace(/\/+$/, '');
  const url = new URL(base + '/session.html');
  url.searchParams.set('sim', META.id);
  url.searchParams.set('session', sess.code);
  if (sess.courseId) url.searchParams.set('course', sess.courseId);
  return url.href;
}

module.exports = { accountJoinUrl };
