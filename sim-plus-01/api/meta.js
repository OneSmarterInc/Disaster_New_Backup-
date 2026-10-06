'use strict';
const { META } = require('../lib/meta');
module.exports = async (_req, res) => res.status(200).json({ meta: META });
