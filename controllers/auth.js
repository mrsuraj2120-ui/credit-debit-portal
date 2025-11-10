// backend/controllers/auth.js
const { readSheet, writeSheet } = require('../utils/excel');
const bcrypt = require('bcryptjs');

/**
 * POST /api/login
 * body: { email, password }
 * Sets req.session.user on success
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const users = readSheet('Users');
    const user = users.find(u => (u.Email || '').toLowerCase() === (email || '').toLowerCase());

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    // Active check
    if ((user.Active || '').toString().toLowerCase() === 'false') {
      return res.status(403).json({ error: 'User is inactive' });
    }

    const hash = user.Password || '';
    const match = await bcrypt.compare(password, hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    // Store minimal safe user details in session
    req.session.user = {
      User_ID: user.User_ID,
      Name: user.Name,
      Email: user.Email,
      Role: user.Role
    };

    res.json({ success: true, user: req.session.user });
  } catch (err) {
    console.error('Login error', err);
    res.status(500).json({ error: 'Server error' });
  }
}

/**
 * GET /api/logout
 */
function logout(req, res) {
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error', err);
    }
    res.json({ success: true });
  });
}

module.exports = { login, logout };
