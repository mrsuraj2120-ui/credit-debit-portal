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
      Particular: it.Particular || '',
      Remarks: it.Remarks || '',
      Quantity: qty,
      Rate: rate,
      Tax_Percentage: taxPerc,
      Tax_Amount: taxAmount,
      Total_Amount: lineTotal
    });
  });

  const validStatuses = ['Draft', 'Created', 'Approved'];
  const cleanStatus = validStatuses.includes(req.body.Status) ? req.body.Status : 'Draft';
  rows[idx].Status = cleanStatus;

  const obj = {
    Transaction_ID: id,
    Type: Type || 'Debit',
    Date: Txn_Date || new Date().toISOString(),  // ✅ use Txn_Date here
    Company_ID: Company_ID || '',
    Vendor_ID: Vendor_ID || '',
    Reference_No: Reference_No || '',
    Reason: Reason || '',
    Total_Amount: total,
    Status: req.body.Status || 'Draft',
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
  try {
    const id = req.params.id;
    const rows = readSheet(SHEET);
    const idx = rows.findIndex(r => r.Transaction_ID === id);
    if (idx === -1) return res.status(404).json({ error: 'Transaction not found' });

    // ✅ Update Transaction master row with Updated_By tracking
const validStatuses = ['Draft', 'Created', 'Approved'];
const prevStatus = rows[idx].Status;
const cleanStatus = validStatuses.includes(req.body.Status)
  ? req.body.Status
  : prevStatus;

const now = new Date().toISOString();
const userName = req.session?.user?.Name || 'Unknown User';

// Only refresh Updated_At and Updated_By when status changes OR items edited
const shouldUpdateTimestamp =
  cleanStatus === 'Created' && prevStatus === 'Draft' ||
  cleanStatus === 'Approved' && prevStatus !== 'Approved' ||
  req.body.Items?.length; // also update when items are modified

const updated = {
  ...rows[idx],
  ...req.body,
  Status: cleanStatus,
  Updated_At: shouldUpdateTimestamp ? now : rows[idx].Updated_At || '',
  Updated_By: shouldUpdateTimestamp ? userName : rows[idx].Updated_By || '',
};


    rows[idx] = updated;
    writeSheet(SHEET, rows);

    // ✅ Update Items logic
    const allItems = readSheet(ITEMS_SHEET);

    // Step 1: Separate current transaction items
    const currentItems = allItems.filter(i => i.Transaction_ID === id);
    const otherItems = allItems.filter(i => i.Transaction_ID !== id);

    // Step 2: Determine next item number (continue sequence)
    let nextItemNum = currentItems.length
      ? Math.max(...currentItems.map(it => {
          const parts = it.Item_ID.split('ITM');
          return Number(parts[1]) || 0;
        })) + 1
      : 1;

    // Step 3: Prepare new item records (update or add)
    const updatedItems = (req.body.Items || []).map((it, idx) => {
      const existing = currentItems[idx];
      let itemId;

      if (existing) {
        // update existing item
        itemId = existing.Item_ID;
      } else {
        // new item → generate next sequential ID
        itemId = `${id}-ITM${String(nextItemNum++).padStart(3, '0')}`;
      }

      const qty = Number(it.Quantity || 0);
      const rate = Number(it.Rate || 0);
      const taxPerc = Number(it.Tax_Percentage || 0);
      const taxAmt = (qty * rate * taxPerc) / 100;
      const total = qty * rate + taxAmt;

      return {
        Item_ID: itemId,
        Transaction_ID: id,
        Particular: it.Particular || '',
        Remarks: it.Remarks || '',
        Quantity: qty,
        Rate: rate,
        Tax_Percentage: taxPerc,
        Tax_Amount: taxAmt,
        Total_Amount: total,
      };
    });

    // Step 4: Merge updated items + other transactions’ items
    const finalItems = otherItems.concat(updatedItems);
    writeSheet(ITEMS_SHEET, finalItems);

    res.json({
      success: true,
      message: 'Transaction and items updated successfully',
      data: updated,
      items: updatedItems,
    });

  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
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

    let subtotal = 0, totalTax = 0;
    items.forEach(it => {
      const amt = parseFloat(it.Total_Amount) || 0;
      const taxP = parseFloat(it.Tax_Percentage) || 0;
      subtotal += amt;
      totalTax += (amt * taxP) / 100;
    });

    const grandTotal = subtotal + totalTax;

    res.setHeader('Content-Disposition', `inline; filename=${id}.pdf`);
    res.setHeader('Content-Type', 'application/pdf');
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    doc.pipe(res);
    const border = '#000000';

    doc.rect(30, 30, 540, 780).strokeColor(border).stroke();

    const headerTitle = tx.Type && tx.Type.toLowerCase() === "credit" ? "CREDIT NOTE" : "DEBIT NOTE";
    doc.font('Helvetica-Bold').fontSize(18).text(headerTitle, { align: 'center' });

    let y = 80;
    doc.font('Helvetica-Bold').fontSize(10).text(`FROM : ${company.Company_Name || 'COMPANY NAME'}`, 40, y + 1);
    doc.font('Helvetica').fontSize(10);
    doc.text(`${company.Address || ''}`, 40, y + 15, { width: 200 });
    y = doc.y + 5;
    doc.text(`PHONE : ${company.Phone || ''}`, 40, y);
    doc.text(`GSTIN : ${company.GSTIN || ''}`, 40, y + 15);

    let x = 80;
    doc.text(`Credit/Debit Note No.: ${tx.Transaction_ID}`, 350, x);
    doc.text(`Date: ${tx.Date || ''}`, 350, x + 15);
    doc.text(`Original Invoice No.: ${tx.Reference_No || ''}`, 350, x + 30);

    doc.font('Helvetica-Bold').fontSize(10).text(`TO : ${vendor.Vendor_Name || 'VENDOR NAME'}`, 40, y + 90);
    doc.font('Helvetica').fontSize(10);
    doc.text(`${vendor.Address || ''}`, 40, y + 105, { width: 200 });
    y = doc.y + 5;
    doc.text(`GSTIN : ${vendor.GSTIN || ''}`, 40, y);
    doc.text(`PHONE : ${vendor.Phone || ''}`, 40, y + 15);

    // ====== Table Header ======
const tableTop = doc.y + 25;
const borderColor = '#000000';

doc.rect(40, tableTop, 520, 20).strokeColor(borderColor).stroke();
doc.font('Helvetica-Bold').fontSize(10);

const headers = [
  { label: 'S. No.', width: 40 },
  { label: 'Particular', width: 110 },
  { label: 'Remarks', width: 70 },
  { label: 'Quantity', width: 55 },
  { label: 'Rate', width: 40 },
  { label: 'Tax Amt', width: 50 },
  { label: 'Total Amount', width: 55 },
];

let colX = 45;
headers.forEach(h => {
  doc.text(h.label, colX, tableTop + 5);
  colX += h.width;
});

// ====== Table Body ======
let rowY = tableTop + 20;
doc.font('Helvetica').fontSize(10);

items.forEach((it, i) => {
  // Prepare data for each column
  const cols = [
    String(i + 1),
    it.Particular || '',
    it.Remarks || '',
    it.Quantity || '',
    (parseFloat(it.Rate) || 0).toFixed(2),
    (parseFloat(it.Tax_Amount) || 0).toFixed(2),
    (parseFloat(it.Total_Amount) || 0).toFixed(2),
  ];

  // Calculate wrapped height for the tallest column (Particular/Remarks)
  const textHeights = [];
  let xPos = 45;

  headers.forEach((h, idx) => {
    const options = { width: h.width - 5 };
    const text = cols[idx];
    const height = doc.heightOfString(text, options) + 8; // 8 for padding
    textHeights.push(height);
    xPos += h.width;
  });

  const rowHeight = Math.max(...textHeights);

  // Draw row border
  doc.rect(40, rowY, 520, rowHeight).strokeColor(borderColor).stroke();

  // Render each column’s text
  let colX = 45;
  headers.forEach((h, idx) => {
    const text = cols[idx];
    const alignRight = ['Rate', 'Tax Amt', 'Total Amount'].includes(h.label);
    doc.text(text, colX, rowY + 4, {
      width: h.width - 5,
      align: alignRight ? 'right' : 'left',
    });
    colX += h.width;
  });

  rowY += rowHeight; // move to next row dynamically
});

// ====== Amount in Words & Totals Box Side-by-Side ======
const amountY = rowY + 10;
doc.font('Helvetica-Bold').text('AMOUNT IN WORDS :', 40, amountY);

doc.font('Helvetica')
  .text(amountToWordsIndian(grandTotal).toUpperCase(), 145, amountY, { width: 170 });

// Now attach totals box right beside it
const boxWidth = 160;
const boxHeight = 50;
const boxX = doc.page.width - boxWidth - 35;
const boxY = amountY - 5;

doc.rect(boxX, boxY, boxWidth, boxHeight).strokeColor(borderColor).stroke();

const labelX = boxX + 10;
const valueWidth = boxWidth - 20;

doc.font('Helvetica').fontSize(10);
doc.text('Total Amount :', labelX, boxY + 5);
doc.text('Tax Amount :', labelX, boxY + 20);
doc.text('Taxable Amount :', labelX, boxY + 35);

doc.text(subtotal.toFixed(2), labelX, boxY + 5, { width: valueWidth, align: 'right' });
doc.text(totalTax.toFixed(2), labelX, boxY + 20, { width: valueWidth, align: 'right' });
doc.text(grandTotal.toFixed(2), labelX, boxY + 35, { width: valueWidth, align: 'right' });

    const sigY = boxY + 100;
    doc.font('Helvetica').text('for ' + (company.Company_Name || 'COMPANY NAME'), 420, sigY);
    doc.text('Authorized Signature', 440, sigY + 45);

    doc.rect(30, 30, 540, 780).strokeColor(border).stroke();
    doc.end();

    function amountToWordsIndian(amount) {
      amount = Number(Number(amount).toFixed(2));
      const rupees = Math.floor(amount);
      const paise = Math.round((amount - rupees) * 100);

      const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
        'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
      const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

      function convertTwoDigits(num) {
        if (num < 20) return ones[num];
        return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
      }

      function convertToWords(num) {
        if (num === 0) return 'Zero';
        let words = '';
        const crore = Math.floor(num / 10000000);
        num %= 10000000;
        const lakh = Math.floor(num / 100000);
        num %= 100000;
        const thousand = Math.floor(num / 1000);
        num %= 1000;
        const hundred = Math.floor(num / 100);
        const rest = num % 100;

        if (crore) words += convertTwoDigits(crore) + ' Crore ';
        if (lakh) words += convertTwoDigits(lakh) + ' Lakh ';
        if (thousand) words += convertTwoDigits(thousand) + ' Thousand ';
        if (hundred) words += ones[hundred] + ' Hundred ';
        if (rest) words += convertTwoDigits(rest) + ' ';
        return words.trim();
      }

      let result = convertToWords(rupees) + ' Rupees';
      if (paise > 0) {
        result += ' and ' + convertToWords(paise) + ' Paise Only';
      } else {
        result += ' Only';
      }
      return result;
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
    const { readSheet } = require('../utils/excel');
    const SHEET = 'Transactions';
    const user = req.session?.user || {};

    const allTx = readSheet(SHEET) || [];

    // 🧩 Admin → all transactions
    // 🧩 Non-admin → filter based on company or creator
    let dataToUse = allTx;
    if (user.Role !== 'Admin') {
      dataToUse = allTx.filter(
        t =>
          t.Company_ID === user.Company_ID ||
          t.Created_By === user.Email ||
          t.User_ID === user.User_ID
      );
    }

    // ✅ Calculations
    const totalCredit = dataToUse.filter(t => t.Type === 'Credit').length;
    const totalDebit = dataToUse.filter(t => t.Type === 'Debit').length;

    const totalCreditAmount = dataToUse
      .filter(t => t.Type === 'Credit')
      .reduce((a, b) => a + Number(b.Total_Amount || 0), 0);
    const totalDebitAmount = dataToUse
      .filter(t => t.Type === 'Debit')
      .reduce((a, b) => a + Number(b.Total_Amount || 0), 0);

    const netBalance = totalCreditAmount - totalDebitAmount;
    const pending = dataToUse.filter(t => {
  const s = (t.Status || '').toLowerCase();
  return s.includes('pending') || s.includes('awaiting') || s.includes('draft');
}).length;


    const recent = dataToUse.slice(-10).reverse();

    return res.json({
      totalCredit,
      totalDebit,
      totalCreditAmount,
      totalDebitAmount,
      netBalance,
      pending,
      recent,
    });
  } catch (err) {
    console.error('Dashboard Summary Error:', err);
    res.status(500).json({ error: 'Failed to load dashboard summary' });
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