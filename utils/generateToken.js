const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'dev_secret';
const signToken = u => jwt.sign({ id: u._id, role: u.role }, SECRET, { expiresIn: '7d' });

module.exports = { SECRET, signToken };
