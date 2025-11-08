// backend/controllers/vendors.js
const { readSheet, writeSheet, appendRow } = require('../utils/excel');
const { nextSequential } = require('../utils/idgen');

const SHEET = 'Vendors';
const ID_FIELD = 'Vendor_ID';

// 🔹 Get all vendors
function list(req, res) {
  const rows = readSheet(SHEET);
  res.json(rows);
}

// 🔹 Create new vendor
function create(req, res) {
  const { Vendor_Name, Address, GSTIN, Contact_Person, Email, Phone, Linked_Company } = req.body;
  const id = nextSequential(SHEET, ID_FIELD, 'VND');

  const obj = {
    Vendor_ID: id,
    Vendor_Name: Vendor_Name || '',
    Address: Address || '',
    GSTIN: GSTIN || '',
    Contact_Person: Contact_Person || '',
    Email: Email || '',
    Phone: Phone || '',
    Linked_Company: Linked_Company || '',
    Created_At: new Date().toISOString()
  };

  appendRow(SHEET, obj);
  res.json({ success: true, data: obj });
}

// 🔹 Get vendor by ID
function get(req, res) {
  const id = req.params.id;
  const rows = readSheet(SHEET);
  const row = rows.find(r => r.Vendor_ID === id);
  if (!row) return res.status(404).json({ error: 'Vendor not found' });
  res.json(row);
}

// 🔹 Update vendor
function update(req, res) {
  const id = req.params.id;
  const rows = readSheet(SHEET);
  const idx = rows.findIndex(r => r.Vendor_ID === id);
  if (idx === -1) return res.status(404).json({ error: 'Vendor not found' });

  const updated = { ...rows[idx], ...req.body };
  rows[idx] = updated;
  writeSheet(SHEET, rows);

  res.json({ success: true, data: updated });
}

// 🔹 Delete vendor
function remove(req, res) {
  const id = req.params.id;
  const rows = readSheet(SHEET);
  const newRows = rows.filter(r => r.Vendor_ID !== id);
  writeSheet(SHEET, newRows);
  res.json({ success: true });
}

module.exports = { list, create, get, update, remove };
