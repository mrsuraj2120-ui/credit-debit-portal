// backend/controllers/users.js
const { readSheet, writeSheet, appendRow } = require('../utils/excel');
const { nextSequential } = require('../utils/idgen');
const bcrypt = require('bcryptjs'); // ✅ new for secure password hashing

const SHEET = 'Users';
const ID_FIELD = 'User_ID';

// ✅ List all users (hide passwords)
function list(req, res) {
  const rows = readSheet(SHEET);
  // Remove passwords before sending
  const sanitized = rows.map(r => {
    const copy = { ...r };
    delete copy.Password;
    return copy;
  });
  res.json(sanitized);
}

// ✅ Create user (Admin only, stores hashed password)
async function create(req, res) {
  try {
    // Only Admin allowed to create
    if (!req.session?.user || req.session.user.Role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied: Admins only' });
    }

    const { Name, Email, Role, Active, Password } = req.body;
    if (!Email || !Password) {
      return res.status(400).json({ error: 'Email and Password are required' });
    }

    const allUsers = readSheet(SHEET);
    if (allUsers.find(u => (u.Email || '').toLowerCase() === Email.toLowerCase())) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const id = nextSequential(SHEET, ID_FIELD, 'USR');
    const hashed = await bcrypt.hash(Password, 10);

    const obj = {
      User_ID: id,
      Name: Name || '',
      Email: Email || '',
      Role: Role || 'Viewer',
      Active: Active || 'TRUE',
      Password: hashed
    };

    appendRow(SHEET, obj);
    const safe = { ...obj };
    delete safe.Password;
    res.json({ success: true, data: safe });
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ✅ Get user by ID (hide password)
function get(req, res) {
  const id = req.params.id;
  const rows = readSheet(SHEET);
  const row = rows.find(r => r.User_ID === id);
  if (!row) return res.status(404).json({ error: 'User not found' });
  const safe = { ...row };
  delete safe.Password;
  res.json(safe);
}

// ✅ Update user (Admin only, hash new password if provided)
async function update(req, res) {
  try {
    if (!req.session?.user || req.session.user.Role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied: Admins only' });
    }

    const id = req.params.id;
    const rows = readSheet(SHEET);
    const idx = rows.findIndex(r => r.User_ID === id);
    if (idx === -1) return res.status(404).json({ error: 'User not found' });

    const updated = { ...rows[idx], ...req.body };

    // Hash password if provided
    if (req.body.Password) {
      updated.Password = await bcrypt.hash(req.body.Password, 10);
    }

    rows[idx] = updated;
    writeSheet(SHEET, rows);
    const safe = { ...updated };
    delete safe.Password;
    res.json({ success: true, data: safe });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ✅ Remove user (Admin only)
function remove(req, res) {
  if (!req.session?.user || req.session.user.Role !== 'Admin') {
    return res.status(403).json({ error: 'Access denied: Admins only' });
  }

  const id = req.params.id;
  const rows = readSheet(SHEET);
  const newRows = rows.filter(r => r.User_ID !== id);
  writeSheet(SHEET, newRows);
  res.json({ success: true });
}

module.exports = { list, create, get, update, remove };
