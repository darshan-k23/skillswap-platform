// routes/users.routes.js
const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  updateUser,
  requestAvatarUpload,
  confirmAvatarUpload,
  deleteAvatar,
} = require('../controllers/users.controller');
const { protect } = require('../middleware/auth.middleware');

// All user routes require authentication
router.use(protect);

router.get('/',                          getAllUsers);          // GET  /api/users
router.get('/:id',                       getUserById);         // GET  /api/users/:id
router.put('/:id',                       updateUser);          // PUT  /api/users/:id
router.post('/:id/avatar/upload-request', requestAvatarUpload); // POST /api/users/:id/avatar/upload-request
router.post('/:id/avatar/confirm',        confirmAvatarUpload);  // POST /api/users/:id/avatar/confirm
router.delete('/:id/avatar',              deleteAvatar);         // DELETE /api/users/:id/avatar

module.exports = router;
