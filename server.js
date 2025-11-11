const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');

const apiRoutes = require('./routes/api');

const app = express();

// ✅ Required when running behind Render proxy (enables secure cookies)
app.set('trust proxy', 1);

// ✅ Allow your frontend Render domain to access backend with cookies
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://credit-debit-portal12.onrender.com'; // <-- change if different

app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ Secure session configuration (works perfectly on Render)
app.use(session({
  name: 'cid',
  secret: process.env.SESSION_SECRET || 'change_this_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // true on HTTPS
    sameSite: 'none', // allows frontend & backend on different domains
    maxAge: 1000 * 60 * 60 * 6 // 6 hours
  }
}));

// ✅ Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// ✅ API routes
app.use('/api', apiRoutes);

// ✅ Session info endpoint (frontend can use this to check login)
app.get('/api/session', (req, res) => {
  res.json(req.session.user || null);
});

// ✅ Fallback route for SPA (always send index.html)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
