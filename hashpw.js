// backend/hashpw.js
const bcrypt = require('bcryptjs');
const pw = process.argv[2] || 'Admin@123';
bcrypt.hash(pw, 10).then(hash => {
  console.log('Password:', pw);
  console.log('Hash:', hash);
});
