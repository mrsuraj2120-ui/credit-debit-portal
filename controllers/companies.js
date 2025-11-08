const { readSheet, writeSheet, appendRow } = require('../utils/excel');
const { nextSequential } = require('../utils/idgen');

const SHEET = 'Companies';
const ID_FIELD = 'Company_ID';

function list(req, res) {
  const rows = readSheet(SHEET);
  res.json(rows);
}

function create(req, res) {
  const { Company_Name, Address, GSTIN, Email, Phone } = req.body;
  const id = nextSequential(SHEET, ID_FIELD, 'CMP');
  const obj = {
    Company_ID: id,
    Company_Name: Company_Name || '',
    Address: Address || '',
    GSTIN: GSTIN || '',
    Email: Email || '',
    Phone: Phone || '',
    Created_At: new Date().toISOString()
  };
  appendRow(SHEET, obj);
  res.json({ success: true, data: obj });
}

function get(req, res) {
  const id = req.params.id;
  const rows = readSheet(SHEET);
  const row = rows.find(r => r.Company_ID === id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
}

function update(req, res) {
  const id = req.params.id;
  const rows = readSheet(SHEET);
  const idx = rows.findIndex(r => r.Company_ID === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const updated = { ...rows[idx], ...req.body };
  rows[idx] = updated;
  writeSheet(SHEET, rows);
  res.json({ success: true, data: updated });
}

function remove(req, res) {
  const id = req.params.id;
  const rows = readSheet(SHEET);
  const newRows = rows.filter(r => r.Company_ID !== id);
  writeSheet(SHEET, newRows);
  res.json({ success: true });
}

module.exports = { list, create, get, update, remove };
