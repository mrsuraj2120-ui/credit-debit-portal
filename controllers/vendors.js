// backend/controllers/vendors.js
const { readSheet, writeSheet, appendRow } = require('../utils/excel');
const { nextSequential } = require('../utils/idgen');

const SHEET = 'Vendors';
const ID_FIELD = 'Vendor_ID';

// 🔹 Get all vendors
function list(req, res) {
  try {
    const rows = readSheet(SHEET);
    res.json(rows);
  } catch (err) {
    console.error('Error reading vendors:', err);
    res.status(500).json({ error: 'Failed to load vendors' });
  }
}

// 🔹 Create new vendor (✅ Updated: non-admins also allowed)
function create(req, res) {
  try {
    const user = req.session.user;
    const { Vendor_Name, Address, GSTIN, Contact_Person, Email, Phone, Linked_Company } = req.body;

    if (!Vendor_Name) return res.status(400).json({ error: 'Vendor name required' });

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
      Created_By: user ? user.Name : 'System',
      Created_At: new Date().toISOString()
    };

    appendRow(SHEET, obj);

    // ✅ Return new vendor object for frontend auto-select
    res.json({ success: true, data: obj });
  } catch (err) {
    console.error('Error creating vendor:', err);
    res.status(500).json({ error: 'Failed to create vendor' });
  }
}

// 🔹 Get vendor by ID
function get(req, res) {
  try {
    const id = req.params.id;
    const rows = readSheet(SHEET);
    const row = rows.find(r => r.Vendor_ID === id);
    if (!row) return res.status(404).json({ error: 'Vendor not found' });
    res.json(row);
  } catch (err) {
    console.error('Error fetching vendor:', err);
    res.status(500).json({ error: 'Failed to get vendor' });
  }
}

// 🔹 Update vendor (Admin only)
function update(req, res) {
  if (!req.session.user || req.session.user.Role !== 'Admin') {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const id = req.params.id;
    const rows = readSheet(SHEET);
    const idx = rows.findIndex(r => r.Vendor_ID === id);
    if (idx === -1) return res.status(404).json({ error: 'Vendor not found' });

    const updated = { ...rows[idx], ...req.body };
    rows[idx] = updated;
    writeSheet(SHEET, rows);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Error updating vendor:', err);
    res.status(500).json({ error: 'Failed to update vendor' });
  }
}

// 🔹 Delete vendor (Admin only)
function remove(req, res) {
  if (!req.session.user || req.session.user.Role !== 'Admin') {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const id = req.params.id;
    const rows = readSheet(SHEET);
    const newRows = rows.filter(r => r.Vendor_ID !== id);
    writeSheet(SHEET, newRows);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting vendor:', err);
    res.status(500).json({ error: 'Failed to delete vendor' });
  }
}

module.exports = { list, create, get, update, remove };
