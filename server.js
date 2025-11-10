const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');

const apiRoutes = require('./routes/api');

const app = express();
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session (memory store) - fine for demo; use Redis or DB for production
app.use(session({
  name: 'cid',
  secret: process.env.SESSION_SECRET || 'change_this_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // set true on HTTPS
    maxAge: 1000 * 60 * 60 * 6 // 6 hours
  }
}));

// Serve frontend static
app.use(express.static(path.join(__dirname, 'public')));

// API prefix
app.use('/api', apiRoutes);

// session info endpoint (client can call to know logged-in user)
app.get('/api/session', (req, res) => {
  res.json(req.session.user || null);
});

// fallback: send index
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
