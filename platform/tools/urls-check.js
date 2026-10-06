// Links must follow whatever address the platform is being reached at, so
// pointing a domain at it needs no configuration.
const { baseUrl } = require(require('path').join(__dirname,'../lib/urls.js'));
const req = (host, proto) => ({ headers: Object.assign({}, host ? { host } : {}, proto ? { 'x-forwarded-proto': proto } : {}) });

delete process.env.PUBLIC_BASE_URL;
console.log('  reached on the vercel address     :', baseUrl(req('flexee-platform.vercel.app')));
console.log('  reached on the domain             :', baseUrl(req('rapidsims.flexee.org')));
console.log('  a proxy chain                     :', baseUrl({ headers:{ 'x-forwarded-host':'rapidsims.flexee.org, edge', 'x-forwarded-proto':'https' } }));
console.log('  local, over http                  :', baseUrl(req('localhost:3000','http')));

process.env.PUBLIC_BASE_URL = 'https://rapidsims.flexee.org/';
console.log('  a setting wins, slash trimmed     :', baseUrl(req('flexee-platform.vercel.app')));
delete process.env.PUBLIC_BASE_URL;
console.log('  no request and no setting         :', JSON.stringify(baseUrl(null)));
