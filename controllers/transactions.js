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
    const itemId = `${id}-ITM${String(idx + 1).padStart(3, '0')}`;
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
    Created_By: (req.session?.user?.Name) || 'Unknown User',
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
  rows[idx].Approved_By = req.session?.user?.Name || 'system';
  writeSheet(SHEET, rows);
  res.json({ success: true, data: rows[idx] });
}



function generatePDF(req, res) {
  try {
    const id = req.params.id;
    const txs = readSheet(SHEET);
    const tx = txs.find(r => r.Transaction_ID === id);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });

    const companies = readSheet("Companies");
    const vendors = readSheet("Vendors");

    const company = companies.find(c => c.Company_ID === tx.Company_ID) || {};
    const vendor = vendors.find(v => v.Vendor_ID === tx.Vendor_ID) || {};
    const items = readSheet(ITEMS_SHEET).filter(i => i.Transaction_ID === id);

    // ---- Totals ----
    let subtotal = 0, totalTax = 0, taxPercent = 0;
    items.forEach(it => {
      const amt = parseFloat(it.Total_Amount) || 0;
      const taxP = parseFloat(it.Tax_Percentage) || 0;
      subtotal += amt;
      totalTax += (amt * taxP) / 100;
      taxPercent = taxP;
    });

    const grandTotal = subtotal + totalTax;
    const roundedTotal = Math.round(grandTotal);

    // ---- PDF Setup ----
    res.setHeader('Content-Disposition', `inline; filename=${id}.pdf`);
    res.setHeader('Content-Type', 'application/pdf');
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    doc.pipe(res);
    const border = '#000000';

    // ---- BORDER OUTLINE ----
    doc.rect(30, 30, 540, 780).strokeColor(border).stroke();

    // ---- HEADER ----
    const headerTitle = tx.Type && tx.Type.toLowerCase() === "credit" ? "CREDIT NOTE" : "DEBIT NOTE";
    doc.font('Helvetica-Bold').fontSize(18).text(headerTitle, { align: 'center' });

    // ---- COMPANY INFO ----
    let y = 80;
    doc.font('Helvetica-Bold').fontSize(10).text(`FROM :${company.Company_Name || 'COMPANY NAME'}`, 40, y + 1 )

    doc.font('Helvetica').fontSize(10);
doc.text(`${company.Address || ''}`, 40, y + 15, { width: 200 });
y = doc.y + 5;  // move below address automatically
doc.text(`PHONE :${company.Phone || ''}`, 40, y);
doc.text(`GSTIN :${company.GSTIN || ''}`, 40, y + 15);


    // ---- RIGHT SIDE INFO ----
    let x = 80;
    doc.text(`Credit/Debit Note No.: ${tx.Transaction_ID}`, 350, x);
    doc.text(`Date: ${tx.Date || ''}`, 350, x + 15);
    doc.text(`Original Invoice No.: ${tx.Reference_No || ''}`, 350, x + 30);

    // ---- CUSTOMER INFO ----
    doc.font('Helvetica-Bold').fontSize(10).text(`TO :${vendor.Vendor_Name || 'VENDER NAME'}`, 40, y + 90 )
    doc.font('Helvetica').fontSize(10)
      doc.font('Helvetica').fontSize(10);
doc.text(`${vendor.Address || ''}`, 40, y + 105, { width: 200 });
y = doc.y + 5; // move down dynamically after wrapped address
doc.text(`GSTIN :${vendor.GSTIN || ''}`, 40, y);
doc.text(`PHONE :${vendor.Phone || ''}`, 40, y + 15);


    // ---- ITEM TABLE HEADER ----
    const tableTop = doc.y + 20;
    const colWidths = [40, 50, 160, 60, 60, 60, 60];
    const headers = ['S. No.', 'Description', 'HSN/SAC', 'Quantity', 'Rate', 'Amount'];

    doc.rect(40, tableTop, 520, 20).strokeColor(border).stroke();
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('S. No.', 45, tableTop + 5);
    doc.text('REASON', 90, tableTop + 5);
    doc.text('HSN/SAC', 240, tableTop + 5);
    doc.text('Quantity', 300, tableTop + 5);
    doc.text('Rate', 370, tableTop + 5);
    doc.text('Tax Amt', 440, tableTop + 5);
    doc.text('Amount', 500, tableTop + 5);
    

    // ---- ITEM ROWS ----
    let rowY = tableTop + 20;
    doc.font('Helvetica').fontSize(10);
    items.forEach((it, i) => {
      doc.rect(40, rowY, 520, 20).strokeColor(border).stroke();
      doc.text(String(i + 1), 45, rowY + 5);
      doc.text(it.Description || '', 90, rowY + 5, { width: 140 });
      doc.text(it.HSN_Code || '', 240, rowY + 5);
      doc.text(it.Quantity || '', 300, rowY + 5);
      doc.text(it.Rate || '', 370, rowY + 5);
      doc.text(it.Tax_Amount || '', 440, rowY + 5);
      doc.text(it.Total_Amount || '', 500, rowY + 5);

      rowY += 20;
    });

    // ---- AMOUNT IN WORDS ----
    const amountY = rowY + 10;
    doc.font('Helvetica-Bold').text('AMOUNT IN WORDS :', 40, amountY);
    doc.font('Helvetica').text(numberToWords(roundedTotal).toUpperCase() + ' ONLY', 150, amountY, { width: 200 });

    // ---- TOTAL BOX (Fixed Alignment) ----
    
const boxWidth = 160;
const boxHeight = 50;
const boxX = doc.page.width - boxWidth - 35;
const boxY = doc.y + 1;

doc.rect(boxX, boxY, boxWidth, boxHeight).strokeColor(border).stroke();

const labelX = boxX + 10;
const valueX = boxX + 10; // same left start; width will handle right alignment
const valueWidth = boxWidth - 20; // right padding = 10px

doc.font('Helvetica').fontSize(10);

// Labels
doc.text('Total Amount :', labelX, boxY + 5);
doc.text('Tax Amount :', labelX, boxY + 20);
doc.text('Taxable Amount :', labelX, boxY + 35);

// Values (aligned cleanly to right edge inside box)
doc.text(subtotal.toFixed(2), valueX, boxY + 5, { width: valueWidth, align: 'right' });
doc.text(totalTax.toFixed(2), valueX, boxY + 20, { width: valueWidth, align: 'right' });
doc.text(grandTotal.toFixed(2), valueX, boxY + 35, { width: valueWidth, align: 'right' });

// ---- SIGNATURE ----
const sigY = boxY + 140;  // ✅ fixed line
doc.font('Helvetica').text('for ' + (company.Company_Name || 'COMPANY NAME'), 440, sigY);
doc.text('Authorized Signature', 450, sigY + 45);

// ---- OUTER BORDER ----
doc.rect(30, 30, 540, 780).strokeColor(border).stroke();
doc.end();


    // ---- HELPER FUNCTION ----
    function numberToWords(num) {
      const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
        'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
      const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
      if ((num = num.toString()).length > 9) return 'Overflow';
      const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{3})(\d{2})$/);
      if (!n) return '';
      let str = '';
      str += (Number(n[1]) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + ' Crore ' : '');
      str += (Number(n[2]) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + ' Lakh ' : '');
      str += (Number(n[3]) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + ' Thousand ' : '');
      str += (Number(n[4]) ? (a[n[4][0]] ? a[n[4][0]] + ' ' + a[n[4][1]] : b[n[4][0]] + ' ' + a[n[4][1]]) : '');
      return str.trim();
    }

  } catch (err) {
    console.error('PDF Generation Error:', err);
    if (!res.headersSent)
      res.status(500).json({ error: 'Failed to generate PDF' });
  }
}

/* ----------------------------------------------------
   ✅ Excel-accurate Dashboard Summary
   (Matches your actual columns exactly)
---------------------------------------------------- */
function dashboardSummary(req, res) {
  try {
    const rows = readSheet(SHEET);
  

    if (!rows || !rows.length) {
      return res.json({
        totalCredit: 0,
        totalDebit: 0,
        totalCreditAmount: 0,
        totalDebitAmount: 0,
        netBalance: 0,
        pending: 0,
        recent: []
      });
    }

    const normalize = (v) => (v || '').toString().trim().toLowerCase();

    // Filter transactions
    const creditNotes = rows.filter(r => normalize(r.Type).includes('credit'));
    const debitNotes = rows.filter(r => normalize(r.Type).includes('debit'));

    // Calculate counts
    const totalCredit = creditNotes.length;
    const totalDebit = debitNotes.length;

    // Calculate total amounts (clean ₹, commas)
    const totalCreditAmount = creditNotes.reduce((sum, r) =>
      sum + (parseFloat((r.Total_Amount || '').toString().replace(/[₹,]/g, '')) || 0), 0);
    const totalDebitAmount = debitNotes.reduce((sum, r) =>
      sum + (parseFloat((r.Total_Amount || '').toString().replace(/[₹,]/g, '')) || 0), 0);

    // Net balance
    const netBalance = totalCreditAmount - totalDebitAmount;

    // Count both Pending and Draft statuses
    const pending = rows.filter(r => {
      const s = normalize(r.Status);
      return s.startsWith('pending') || s.startsWith('draft');
    }).length;

    // Sort by Created_At date (recent 5)
    const recent = rows
      .filter(r => r.Transaction_ID)
      .sort((a, b) => new Date(b.Created_At) - new Date(a.Created_At))
      .slice(0, 5);

    res.json({
      totalCredit,
      totalDebit,
      totalCreditAmount,
      totalDebitAmount,
      netBalance,
      pending,
      recent
    });

  } catch (err) {
    console.error('Dashboard summary error:', err);
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
}

/* ----------------------------------------------------
   ✅ Excel-accurate User Dashboard (Company/Vendor wise)
---------------------------------------------------- */
function userDashboardSummary(req, res) {
  try {
    const rows = readSheet(SHEET);
    const user = req.session.user;


    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const normalize = (v) => (v || '').toString().trim().toLowerCase();

    // Filter only user’s data by Company_ID or Vendor_ID
    const userTx = rows.filter(r =>
  normalize(r.Created_By) === normalize(user.Name) ||
  normalize(r.Approved_By) === normalize(user.Name)
);


    // Credit / Debit Filters
    const creditNotes = userTx.filter(r => normalize(r.Type).includes('credit'));
    const debitNotes = userTx.filter(r => normalize(r.Type).includes('debit'));

    // Totals
    const totalCredit = creditNotes.length;
    const totalDebit = debitNotes.length;

    const totalCreditAmount = creditNotes.reduce((sum, r) =>
      sum + (parseFloat((r.Total_Amount || '').toString().replace(/[₹,]/g, '')) || 0), 0);
    const totalDebitAmount = debitNotes.reduce((sum, r) =>
      sum + (parseFloat((r.Total_Amount || '').toString().replace(/[₹,]/g, '')) || 0), 0);

    const netBalance = totalCreditAmount - totalDebitAmount;

    // ✅ FIXED: Pending count for THIS USER ONLY
    const pending = userTx.filter(r => {
      const s = normalize(r.Status);
      return s.startsWith('pending') || s.startsWith('draft');
    }).length;

    // ✅ Recent 5 user transactions
    const recent = userTx
      .filter(r => r.Transaction_ID)
      .sort((a, b) => new Date(b.Created_At) - new Date(a.Created_At))
      .slice(0, 5);

    res.json({
      totalCredit,
      totalDebit,
      totalCreditAmount,
      totalDebitAmount,
      netBalance,
      pending,
      recent
    });
  } catch (err) {
    console.error('User dashboard error:', err);
    res.status(500).json({ error: 'Failed to load user dashboard data' });
  }
}


module.exports = { list, create, get, update, approve, generatePDF, dashboardSummary, userDashboardSummary };