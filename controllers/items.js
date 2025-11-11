// backend/controllers/items.js
const { readSheet, writeSheet, appendRow } = require('../utils/excel');
const { nextSequential } = require('../utils/idgen');

const SHEET = 'Items';
const ID_FIELD = 'Item_ID';

// 🔹 List all items
function list(req, res) {
  const rows = readSheet(SHEET);
  res.json(rows);
}

// 🔹 Create a new item (✅ Modified: support for new Particular/Remarks auto-save)
function create(req, res) {
  const {
    Transaction_ID,
    Description, // ✅ Will be treated as Particular
    HSN_Code,    // ✅ Will be treated as Remarks
    Quantity,
    Rate,
    Tax_Percentage
  } = req.body;

  const id = nextSequential(SHEET, ID_FIELD, 'ITM');
  const qty = Number(Quantity || 0);
  const rate = Number(Rate || 0);
  const taxPerc = Number(Tax_Percentage || 0);
  const taxAmount = (qty * rate * taxPerc) / 100;
  const total = qty * rate + taxAmount;

  const obj = {
    Item_ID: id,
    Transaction_ID: Transaction_ID || '',
    Particular: Description || '', // ✅ Renamed field logic
    Remarks: HSN_Code || '',       // ✅ Renamed field logic
    Quantity: qty,
    Rate: rate,
    Tax_Percentage: taxPerc,
    Tax_Amount: taxAmount,
    Total_Amount: total
  };

  appendRow(SHEET, obj);

  res.json({ success: true, data: obj });
}

// 🔹 Get unique Particular & Remarks values
function getUnique(req, res) {
  try {
    const rows = readSheet(SHEET);

    // Extract unique non-empty values
    const particulars = [...new Set(rows.map(r => (r.Particular || r.Description || '').trim()).filter(v => v))];
    const remarks = [...new Set(rows.map(r => (r.Remarks || r.HSN_Code || '').trim()).filter(v => v))];

    res.json({
      Particulars: particulars.sort(),
      Remarks: remarks.sort()
    });
  } catch (err) {
    console.error('Error reading unique items:', err);
    res.status(500).json({ error: 'Failed to read unique values' });
  }
}

// 🔹 Get item by ID
function get(req, res) {
  const id = req.params.id;
  const rows = readSheet(SHEET);
  const row = rows.find(r => r.Item_ID === id);
  if (!row) return res.status(404).json({ error: 'Item not found' });
  res.json(row);
}

// 🔹 Update item
function update(req, res) {
  const id = req.params.id;
  const rows = readSheet(SHEET);
  const idx = rows.findIndex(r => r.Item_ID === id);
  if (idx === -1) return res.status(404).json({ error: 'Item not found' });

  const updated = { ...rows[idx], ...req.body };
  rows[idx] = updated;
  writeSheet(SHEET, rows);

  res.json({ success: true, data: updated });
}

// 🔹 Delete item
function remove(req, res) {
  const id = req.params.id;
  const rows = readSheet(SHEET);
  const newRows = rows.filter(r => r.Item_ID !== id);
  writeSheet(SHEET, newRows);
  res.json({ success: true });
}

// ✅ Export all functions
module.exports = { list, create, get, update, remove, getUnique };
