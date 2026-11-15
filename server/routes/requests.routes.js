// routes/requests.routes.js
const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const {
  getRequests,
  createRequest,
  updateRequest,
  deleteRequest,
} = require('../controllers/requests.controller');
const { protect } = require('../middleware/auth.middleware');
const { isValidObjectId } = require('../utils/validators');

// All request routes require authentication
router.use(protect);

// ── Validation Rules ─────────────────────────────────────────────────────────
const createRequestValidation = [
  body('receiverId')
    .isString().withMessage('receiverId must be a string')
    .trim()
    .notEmpty().withMessage('receiverId is required')
    .custom((val) => isValidObjectId(val))
    .withMessage('Invalid receiverId format. Must be a 24-character hexadecimal ObjectId'),
  body('offeredSkillId')
    .isString().withMessage('offeredSkillId must be a string')
    .trim()
    .notEmpty().withMessage('offeredSkillId is required')
    .custom((val) => isValidObjectId(val))
    .withMessage('Invalid offeredSkillId format. Must be a 24-character hexadecimal ObjectId'),
  body('wantedSkillId')
    .isString().withMessage('wantedSkillId must be a string')
    .trim()
    .notEmpty().withMessage('wantedSkillId is required')
    .custom((val) => isValidObjectId(val))
    .withMessage('Invalid wantedSkillId format. Must be a 24-character hexadecimal ObjectId'),
  body('message')
    .optional()
    .isString().withMessage('Message must be a string')
    .trim()
    .isLength({ max: 300 }).withMessage('Message cannot exceed 300 characters'),
];

const updateRequestValidation = [
  param('id')
    .custom((val) => isValidObjectId(val))
    .withMessage('Invalid request ID format'),
  body('status')
    .isString().withMessage('Status must be a string')
    .trim()
    .notEmpty().withMessage('Status is required')
    .isIn(['accepted', 'declined']).withMessage('Status must be "accepted" or "declined"'),
];

const deleteRequestValidation = [
  param('id')
    .custom((val) => isValidObjectId(val))
    .withMessage('Invalid request ID format'),
];

// ── Routes ───────────────────────────────────────────────────────────────────
router.get('/',       getRequests);                                 // GET    /api/requests
router.post('/',      createRequestValidation, createRequest);      // POST   /api/requests
router.put('/:id',    updateRequestValidation, updateRequest);      // PUT    /api/requests/:id
router.delete('/:id', deleteRequestValidation, deleteRequest);      // DELETE /api/requests/:id

module.exports = router;
module.exports.createRequestValidation = createRequestValidation;
module.exports.updateRequestValidation = updateRequestValidation;
module.exports.deleteRequestValidation = deleteRequestValidation;
