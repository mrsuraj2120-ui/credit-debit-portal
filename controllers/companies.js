// backend/controllers/companies.js
const { readSheet, writeSheet, appendRow } = require('../utils/excel');
const { nextSequential } = require('../utils/idgen');

const SHEET = 'Companies';
const ID_FIELD = 'Company_ID';

// 🔹 List all companies
function list(req, res) {
  try {
    const rows = readSheet(SHEET);
    res.json(rows);
  } catch (err) {
    console.error('Error listing companies:', err);
    res.status(500).json({ error: 'Failed to load companies' });
  }
}

// 🔹 Get single company by ID
function get(req, res) {
  try {
    const id = req.params.id;
    const rows = readSheet(SHEET);
    const row = rows.find(r => r.Company_ID === id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    console.error('Error getting company:', err);
    res.status(500).json({ error: 'Failed to get company' });
  }
}

// 🔹 Create new company (✅ Modified: Allow non-admin also)
function create(req, res) {
  try {
    const user = req.session.user;
    const isAdmin = user && user.Role === 'Admin';

    // ✅ Non-admin users can add, but admin check removed
    const { Company_Name, Address, GSTIN, Email, Phone } = req.body;
    if (!Company_Name) return res.status(400).json({ error: 'Company name required' });

    const id = nextSequential(SHEET, ID_FIELD, 'CMP');
    const obj = {
      Company_ID: id,
      Company_Name: Company_Name || '',
      Address: Address || '',
      GSTIN: GSTIN || '',
      Email: Email || '',
      Phone: Phone || '',
      Created_By: user ? user.Name : 'System',
      Created_At: new Date().toISOString()
    };

    appendRow(SHEET, obj);

    // ✅ Important: Return object directly for frontend auto-select
    res.json({ success: true, data: obj });
  } catch (err) {
    console.error('Error creating company:', err);
    res.status(500).json({ error: 'Failed to create company' });
  }
}

// 🔹 Update company (Admin only)
function update(req, res) {
  if (!req.session.user || req.session.user.Role !== 'Admin') {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const id = req.params.id;
    const rows = readSheet(SHEET);
    const idx = rows.findIndex(r => r.Company_ID === id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });

    const updated = { ...rows[idx], ...req.body };
    rows[idx] = updated;
    writeSheet(SHEET, rows);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Error updating company:', err);
    res.status(500).json({ error: 'Failed to update company' });
  }
}

// 🔹 Delete company (Admin only)
function remove(req, res) {
  if (!req.session.user || req.session.user.Role !== 'Admin') {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const id = req.params.id;
    const rows = readSheet(SHEET);
    const newRows = rows.filter(r => r.Company_ID !== id);
    writeSheet(SHEET, newRows);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting company:', err);
    res.status(500).json({ error: 'Failed to delete company' });
  }
}

module.exports = { list, create, get, update, remove };
