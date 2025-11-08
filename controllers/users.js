const { readSheet, writeSheet, appendRow } = require('../utils/excel');
const { nextSequential } = require('../utils/idgen');

const SHEET = 'Users';
const ID_FIELD = 'User_ID';

function list(req, res) {
  const rows = readSheet(SHEET);
  res.json(rows);
}

function create(req, res) {
  const { Name, Email, Role, Active } = req.body;
  const id = nextSequential(SHEET, ID_FIELD, 'USR');
  const obj = {
    User_ID: id,
    Name: Name || '',
    Email: Email || '',
    Role: Role || 'Viewer',
    Active: Active || 'TRUE'
  };
  appendRow(SHEET, obj);
  res.json({ success: true, data: obj });
}

function get(req, res) {
  const id = req.params.id;
  const rows = readSheet(SHEET);
  const row = rows.find(r => r.User_ID === id);
  if (!row) return res.status(404).json({ error: 'User not found' });
  res.json(row);
}

function update(req, res) {
  const id = req.params.id;
  const rows = readSheet(SHEET);
  const idx = rows.findIndex(r => r.User_ID === id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  const updated = { ...rows[idx], ...req.body };
  rows[idx] = updated;
  writeSheet(SHEET, rows);
  res.json({ success: true, data: updated });
}

function remove(req, res) {
  const id = req.params.id;
  const rows = readSheet(SHEET);
  const newRows = rows.filter(r => r.User_ID !== id);
  writeSheet(SHEET, newRows);
  res.json({ success: true });
}

module.exports = { list, create, get, update, remove };
