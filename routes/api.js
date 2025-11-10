const express = require('express');
const router = express.Router();

const companies = require('../controllers/companies');
const vendors = require('../controllers/vendors');
const transactions = require('../controllers/transactions');
const items = require('../controllers/items');
const users = require('../controllers/users');
const auth = require('../controllers/auth');


// Auth
router.post('/login', auth.login);
router.get('/logout', auth.logout);

// Companies
router.get('/companies', companies.list);
router.post('/companies', companies.create);
router.get('/companies/:id', companies.get);
router.put('/companies/:id', companies.update);
router.delete('/companies/:id', companies.remove);

// Vendors
router.get('/vendors', vendors.list);
router.post('/vendors', vendors.create);
router.get('/vendors/:id', vendors.get);
router.put('/vendors/:id', vendors.update);
router.delete('/vendors/:id', vendors.remove);

// Transactions
router.get('/transactions', transactions.list);
router.post('/transactions', transactions.create);
router.get('/transactions/:id', transactions.get);
router.put('/transactions/:id', transactions.update);
router.post('/transactions/:id/approve', transactions.approve);
router.get('/transactions/:id/pdf', transactions.generatePDF);

// Items
router.get('/items', items.list);
router.post('/items', items.create);
router.get('/items/:id', items.get);
router.put('/items/:id', items.update);
router.delete('/items/:id', items.remove);

// Users
router.get('/users', users.list);
router.post('/users', users.create);
router.get('/users/:id', users.get);
router.put('/users/:id', users.update);
router.delete('/users/:id', users.remove);

router.get('/dashboard', transactions.dashboardSummary);
router.get('/user-dashboard', transactions.userDashboardSummary);




module.exports = router;
