'use strict';
// Local run: DEV_OPEN=1 node server.js  (DEV_OPEN skips the launch token; never set it on Vercel)
const http = require('http');
const { createApp } = require('./lib/app');
const port = Number(process.env.PORT || 3010);
http.createServer(createApp()).listen(port, () => console.log(`sim10 on http://localhost:${port}`));
