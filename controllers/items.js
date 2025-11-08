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

// 🔹 Create a new item
function create(req, res) {
  const { Transaction_ID, Description, HSN_Code, Quantity, Rate, Tax_Percentage } = req.body;

  const id = nextSequential(SHEET, ID_FIELD, 'ITM');

  const qty = Number(Quantity || 0);
  const rate = Number(Rate || 0);
  const taxPerc = Number(Tax_Percentage || 0);
  const taxAmount = (qty * rate * taxPerc) / 100;
  const total = qty * rate + taxAmount;

  const obj = {
    Item_ID: id,
    Transaction_ID: Transaction_ID || '',
    Description: Description || '',
    HSN_Code: HSN_Code || '',
    Quantity: qty,
    Rate: rate,
    Tax_Percentage: taxPerc,
    Tax_Amount: taxAmount,
    Total_Amount: total
  };

  appendRow(SHEET, obj);
  res.json({ success: true, data: obj });
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

module.exports = { list, create, get, update, remove };
