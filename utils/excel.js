const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const DB_PATH = path.join(__dirname, '..', 'data', 'database.xlsx');

const DEFAULT_SHEETS = {
  Companies: [
    ["Company_ID","Company_Name","Address","GSTIN","Email","Phone","Created_At"]
  ],
  Vendors: [
    ["Vendor_ID","Vendor_Name","Address","GSTIN","Contact_Person","Email","Phone","Linked_Company","Created_At"]
  ],
  Transactions: [
    ["Transaction_ID","Type","Date","Company_ID","Vendor_ID","Reference_No","Reason","Total_Amount","Status","Created_By","Created_At","Approved_By"]
  ],
  Items: [
    ["Item_ID","Transaction_ID","Description","HSN_Code","Quantity","Rate","Tax_Percentage","Tax_Amount","Total_Amount"]
  ],
  Settings: [
    ["Setting_Name","Value"]
  ],
  Users: [
    ["User_ID","Name","Email","Role","Active"]
  ]
};

function ensureDB() {
  if (!fs.existsSync(DB_PATH)) {
    const wb = XLSX.utils.book_new();
    Object.keys(DEFAULT_SHEETS).forEach(name => {
      const ws = XLSX.utils.aoa_to_sheet(DEFAULT_SHEETS[name]);
      XLSX.utils.book_append_sheet(wb, ws, name);
    });
    // default settings
    const settings = [
      ["Debit_Prefix","DBN"],
      ["Credit_Prefix","CRN"],
      ["Financial_Year","2025-26"],
      ["Default_Tax","18"],
      ["Note_Number_Start","001"]
    ];
    const sheet = XLSX.utils.aoa_to_sheet(settings);
    wb.Sheets.Settings = sheet;
    XLSX.writeFile(wb, DB_PATH);
  }
}

function readSheet(sheetName) {
  ensureDB();
  const workbook = XLSX.readFile(DB_PATH);
  const ws = workbook.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: "" });
}

function writeSheet(sheetName, dataArrayOfObjects) {
  ensureDB();
  const workbook = XLSX.readFile(DB_PATH);
  const ws = XLSX.utils.json_to_sheet(dataArrayOfObjects, { skipHeader: false });
  workbook.Sheets[sheetName] = ws;
  workbook.SheetNames = workbook.SheetNames.includes(sheetName) ? workbook.SheetNames : workbook.SheetNames.concat([sheetName]);
  XLSX.writeFile(workbook, DB_PATH);
}

function appendRow(sheetName, obj) {
  const rows = readSheet(sheetName);
  rows.push(obj);
  writeSheet(sheetName, rows);
  return obj;
}

module.exports = { DB_PATH, ensureDB, readSheet, writeSheet, appendRow };
