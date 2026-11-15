// routes/skills.routes.js
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getAllSkills,
  createSkill,
  updateSkill,
  deleteSkill,
} = require('../controllers/skills.controller');
const { protect } = require('../middleware/auth.middleware');
const { SKILL_TYPES, SKILL_CATEGORIES } = require('../utils/validators');

// All skill routes require authentication
router.use(protect);

// ── Validation Rules ─────────────────────────────────────────────────────────
const createSkillValidation = [
  body('name')
    .isString().withMessage('Skill name must be a string')
    .trim()
    .notEmpty().withMessage('Skill name is required')
    .isLength({ min: 2, max: 60 }).withMessage('Skill name must be between 2 and 60 characters'),
  body('type')
    .isString().withMessage('Skill type must be a string')
    .trim()
    .notEmpty().withMessage('Skill type is required')
    .isIn(SKILL_TYPES).withMessage(`Skill type must be either 'offer' or 'want'`),
  body('description')
    .optional()
    .isString().withMessage('Description must be a string')
    .trim()
    .isLength({ max: 200 }).withMessage('Description cannot exceed 200 characters'),
  body('category')
    .optional()
    .isString().withMessage('Category must be a string')
    .trim()
    .isIn(SKILL_CATEGORIES).withMessage(`Category must be one of: ${SKILL_CATEGORIES.join(', ')}`),
];

const updateSkillValidation = [
  body('name')
    .optional()
    .isString().withMessage('Skill name must be a string')
    .trim()
    .isLength({ min: 2, max: 60 }).withMessage('Skill name must be between 2 and 60 characters'),
  body('type')
    .optional()
    .isString().withMessage('Skill type must be a string')
    .trim()
    .isIn(SKILL_TYPES).withMessage(`Skill type must be either 'offer' or 'want'`),
  body('description')
    .optional()
    .isString().withMessage('Description must be a string')
    .trim()
    .isLength({ max: 200 }).withMessage('Description cannot exceed 200 characters'),
  body('category')
    .optional()
    .isString().withMessage('Category must be a string')
    .trim()
    .isIn(SKILL_CATEGORIES).withMessage(`Category must be one of: ${SKILL_CATEGORIES.join(', ')}`),
];

// ── Routes ───────────────────────────────────────────────────────────────────
router.get('/',       getAllSkills);
router.post('/',      createSkillValidation, createSkill);
router.put('/:id',    updateSkillValidation, updateSkill);
router.delete('/:id', deleteSkill);

module.exports = router;
module.exports.createSkillValidation = createSkillValidation;
module.exports.updateSkillValidation = updateSkillValidation;
