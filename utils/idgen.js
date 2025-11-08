const { readSheet, writeSheet } = require('./excel');

function pad(num, size=3) {
  return num.toString().padStart(size, '0');
}

function nextSequential(sheetName, idField, prefix) {
  const rows = readSheet(sheetName);
  if (!rows || rows.length === 0) {
    return prefix + pad(1, 3);
  }
  // find last id, numeric tail
  const last = rows[rows.length - 1][idField];
  if (!last) return prefix + pad(1,3);
  // extract trailing digits
  const m = last.match(/(\d+)$/);
  let val = m ? parseInt(m[1], 10) + 1 : rows.length + 1;
  return prefix + pad(val, 3);
}

module.exports = { nextSequential, pad };
