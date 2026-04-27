// routes/users.routes.js
const express = require('express');
const router = express.Router();
const { getAllUsers, getUserById, updateUser } = require('../controllers/users.controller');
const { protect } = require('../middleware/auth.middleware');

// All user routes require authentication
router.use(protect);

router.get('/',     getAllUsers);    // GET  /api/users
router.get('/:id',  getUserById);   // GET  /api/users/:id
router.put('/:id',  updateUser);    // PUT  /api/users/:id

module.exports = router;
