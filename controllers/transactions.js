const { readSheet, writeSheet, appendRow } = require('../utils/excel');
const { nextSequential } = require('../utils/idgen');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const SHEET = 'Transactions';
const ID_FIELD = 'Transaction_ID';
const ITEMS_SHEET = 'Items';

function list(req, res) {
  const rows = readSheet(SHEET);
  res.json(rows);
}

function create(req, res) {
  // ✅ renamed Date -> Txn_Date to avoid shadowing built-in Date()
  const { Type, Date: Txn_Date, Company_ID, Vendor_ID, Reference_No, Reason, Items, Created_By } = req.body;

  // Generate ID prefix based on Type
  const prefix = Type && Type.toLowerCase() === 'credit' ? 'CRN' : 'DBN';
  const id = nextSequential(SHEET, ID_FIELD, `${prefix}`);

  // calculate totals from Items array
  let total = 0;
  const itemRecords = [];
  (Items || []).forEach((it, idx) => {
    const itemId = `${id}-ITM${String(idx+1).padStart(3,'0')}`;
    const qty = Number(it.Quantity || 0);
    const rate = Number(it.Rate || 0);
    const taxPerc = Number(it.Tax_Percentage || 0);
    const taxAmount = (qty * rate) * taxPerc / 100;
    const lineTotal = qty * rate + taxAmount;
    total += lineTotal;
    itemRecords.push({
      Item_ID: itemId,
      Transaction_ID: id,
      Description: it.Description || '',
      HSN_Code: it.HSN_Code || '',
      Quantity: qty,
      Rate: rate,
      Tax_Percentage: taxPerc,
      Tax_Amount: taxAmount,
      Total_Amount: lineTotal
    });
  });

  const obj = {
    Transaction_ID: id,
    Type: Type || 'Debit',
    Date: Txn_Date || new Date().toISOString(),  // ✅ use Txn_Date here
    Company_ID: Company_ID || '',
    Vendor_ID: Vendor_ID || '',
    Reference_No: Reference_No || '',
    Reason: Reason || '',
    Total_Amount: total,
    Status: 'Draft',
    Created_By: Created_By || '',
    Created_At: new Date().toISOString(),
    Approved_By: ''
  };

  appendRow(SHEET, obj);

  // append items
  const existingItems = readSheet(ITEMS_SHEET);
  const newItems = existingItems.concat(itemRecords);
  writeSheet(ITEMS_SHEET, newItems);

  res.json({ success: true, data: obj, items: itemRecords });
}

function get(req, res) {
  const id = req.params.id;
  const rows = readSheet(SHEET);
  const row = rows.find(r => r.Transaction_ID === id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  // get items
  const items = readSheet(ITEMS_SHEET).filter(i => i.Transaction_ID === id);
  res.json({ ...row, items });
}

function update(req, res) {
  const id = req.params.id;
  const rows = readSheet(SHEET);
  const idx = rows.findIndex(r => r.Transaction_ID === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const updated = { ...rows[idx], ...req.body };
  rows[idx] = updated;
  writeSheet(SHEET, rows);
  res.json({ success: true, data: updated });
}

function approve(req, res) {
  const id = req.params.id;
  const rows = readSheet(SHEET);
  const idx = rows.findIndex(r => r.Transaction_ID === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  rows[idx].Status = 'Approved';
  rows[idx].Approved_By = req.body.approved_by || 'system';
  writeSheet(SHEET, rows);
  res.json({ success: true, data: rows[idx] });
}

function generatePDF(req, res) {
  try {
    const id = req.params.id;
    const rows = readSheet(SHEET);
    const tx = rows.find(r => r.Transaction_ID === id);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });

    const items = readSheet(ITEMS_SHEET).filter(i => i.Transaction_ID === id);

    // Calculate totals
    let subtotal = 0;
    let totalTaxAmt = 0;
    let taxPercent = 0;

    items.forEach(it => {
      const amt = parseFloat(it.Total_Amount) || 0;
      const taxP = parseFloat(it.Tax_Percentage) || 0;
      subtotal += amt;
      totalTaxAmt += (amt * taxP) / 100;
      taxPercent = taxP; // assuming uniform tax
    });

    const grandTotal = subtotal + totalTaxAmt;
    const roundedTotal = Math.round(grandTotal);
    const roundOff = (roundedTotal - grandTotal).toFixed(2);

    // ===== PDF CONFIG =====
    res.setHeader('Content-Disposition', `attachment; filename=${id}.pdf`);
    res.setHeader('Content-Type', 'application/pdf');
    const doc = new PDFDocument({ margin: 30 });
    doc.pipe(res);

    const blue = '#3F3FBF';
    const borderGray = '#BFBFBF';

    // ===== HEADER =====
    doc.rect(30, 30, 540, 40).fill(blue);
    doc.fillColor('white').fontSize(20).text(tx.Type.toUpperCase() + ' NOTE', 0, 42, { align: 'center' });
    doc.moveDown(2);
    doc.fillColor('black').fontSize(10);

    const startY = 90;
    doc.fontSize(11).text(`Business Name : ${tx.Company_ID || ''}`, 40, startY);
    doc.text(`GSTIN No : ${tx.GSTIN || ''}`, 320, startY);
    doc.text(`Address : ${tx.Address || ''}`, 40, startY + 15);
    doc.text(`State : ${tx.State || ''}`, 320, startY + 15);
    doc.text(`Phone Number : ${tx.Phone || ''}`, 40, startY + 30);

    try {
      doc.image('public/logo.png', 470, 35, { width: 60 }).stroke();
    } catch {}

    // ===== RETURN / SHIPPING =====
    const secY = 150;
    doc.rect(30, secY, 260, 20).fill(blue);
    doc.fillColor('white').fontSize(11).text('Return / Credit From', 40, secY + 4);
    doc.rect(310, secY, 260, 20).fill(blue);
    doc.text('Shipping From', 320, secY + 4);

    doc.fillColor('black').fontSize(10);
    doc.text(`Name : ${tx.Vendor_ID || ''}`, 40, secY + 30);
    doc.text(`Address : ${tx.Vendor_Address || ''}`, 40, secY + 45);
    doc.text(`Phone No : ${tx.Vendor_Phone || ''}`, 40, secY + 60);
    doc.text(`GSTIN : ${tx.Vendor_GSTIN || ''}`, 40, secY + 75);
    doc.text(`State : ${tx.Vendor_State || ''}`, 40, secY + 90);
    doc.text(`Date : ${tx.Date || ''}`, 320, secY + 30);
    doc.text(`Credit Note No : ${tx.Transaction_ID}`, 320, secY + 45);
    doc.text(`Buyer's Ref : ${tx.Buyer_Ref || ''}`, 320, secY + 60);

    // ===== ITEMS TABLE =====
    const tableY = secY + 120;
    doc.rect(30, tableY, 540, 20).fill(blue);
    doc.fillColor('white').fontSize(10);
    doc.text('S.No', 35, tableY + 5);
    doc.text('Goods Description', 70, tableY + 5);
    doc.text('HSN', 250, tableY + 5);
    doc.text('QTY', 310, tableY + 5);
    doc.text('MRP', 370, tableY + 5);
    doc.text('Amount', 440, tableY + 5);

    let y = tableY + 25;
    doc.fillColor('black');
    items.forEach((it, i) => {
      doc.rect(30, y - 2, 540, 18).strokeColor(borderGray).stroke();
      doc.text(String(i + 1), 35, y + 3);
      doc.text(it.Description || '', 70, y + 3, { width: 160 });
      doc.text(it.HSN || '', 250, y + 3);
      doc.text(it.Quantity || '', 310, y + 3);
      doc.text(it.Rate || '', 370, y + 3);
      doc.text(it.Total_Amount || '', 440, y + 3);
      y += 20;
    });

    // ===== TOTAL CALCULATION BOX (Tally Style) =====
    y += 10;
    doc.rect(350, y, 220, 90).strokeColor(borderGray).stroke();
    doc.fontSize(10);
    doc.text('Subtotal :', 360, y + 5);
    doc.text(subtotal.toFixed(2), 500, y + 5, { align: 'right' });
    doc.text(`Tax (${taxPercent}%) :`, 360, y + 20);
    doc.text(totalTaxAmt.toFixed(2), 500, y + 20, { align: 'right' });
    doc.text('Grand Total :', 360, y + 35);
    doc.text(grandTotal.toFixed(2), 500, y + 35, { align: 'right' });
    doc.text('Round Off :', 360, y + 50);
    doc.text(roundOff, 500, y + 50, { align: 'right' });
    doc.text('Net Payable :', 360, y + 65);
    doc.font('Helvetica-Bold').text(roundedTotal.toFixed(2), 500, y + 65, { align: 'right' });
    doc.font('Helvetica');

    // ===== BANK DETAILS BOX =====
    y += 100;
    doc.rect(30, y, 300, 60).strokeColor(borderGray).stroke();
    doc.fontSize(10).text('Bank Details', 40, y + 5, { underline: true });
    doc.text(`Account Name : ${tx.Account_Name || ''}`, 40, y + 20);
    doc.text(`Account Number : ${tx.Account_Number || ''}`, 40, y + 35);
    doc.text(`IFSC Code : ${tx.IFSC_Code || ''}`, 40, y + 50);

    // End PDF
    doc.end();
  } catch (err) {
    console.error('PDF Generation Error:', err);
    if (!res.headersSent)
      return res.status(500).json({ error: 'Failed to generate PDF' });
  }
}

module.exports = { list, create, get, update, approve, generatePDF };
