// controllers/skills.controller.js
// Handles CRUD for Skill documents
const { validationResult } = require('express-validator');
const Skill = require('../models/Skill');
const { attachSkillAvatar } = require('../services/s3.service');
const {
  SKILL_TYPES,
  SKILL_CATEGORIES,
  isValidSkillType,
  isValidSkillCategory,
  isValidObjectId,
} = require('../utils/validators');

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all skills (paginated, with validated filters)
// @route   GET /api/skills
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getAllSkills = async (req, res, next) => {
  try {
    // 1. Validate query parameters as primitive strings
    for (const key of Object.keys(req.query)) {
      if (typeof req.query[key] !== 'string') {
        return res.status(400).json({
          success: false,
          message: `Query parameter '${key}' must be a string`,
        });
      }
    }

    const { type, category, userId, search, page, limit } = req.query;
    const filter = {};

    // 2. Validate userId as a MongoDB ObjectId
    if (userId !== undefined) {
      if (!isValidObjectId(userId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid userId format. Must be a 24-character hexadecimal ObjectId',
        });
      }
      filter.userId = userId;
    }

    // 3. Validate type against existing allowed values
    if (type !== undefined) {
      if (!isValidSkillType(type)) {
        return res.status(400).json({
          success: false,
          message: `Skill type must be either 'offer' or 'want'`,
        });
      }
      filter.type = type;
    }

    // 4. Validate and length-limit category
    if (category !== undefined) {
      if (category.length > 50 || !isValidSkillCategory(category)) {
        return res.status(400).json({
          success: false,
          message: `Invalid category. Must be one of: ${SKILL_CATEGORIES.join(', ')}`,
        });
      }
      filter.category = category.trim();
    }

    // 5. Validate and length-limit search
    if (search !== undefined) {
      if (search.length > 100) {
        return res.status(400).json({
          success: false,
          message: 'Search query cannot exceed 100 characters',
        });
      }
      if (search.trim()) {
        const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter.$or = [
          { name: { $regex: escaped, $options: 'i' } },
          { description: { $regex: escaped, $options: 'i' } },
        ];
      }
    }

    // 6. Pagination validation (defaults: page 1, limit 20, max limit 100)
    let pageNum = 1;
    let limitNum = 20;

    if (page !== undefined) {
      const parsedPage = Number(page);
      if (!Number.isInteger(parsedPage) || parsedPage < 1) {
        return res.status(400).json({
          success: false,
          message: 'Page must be a positive integer greater than or equal to 1',
        });
      }
      pageNum = parsedPage;
    }

    if (limit !== undefined) {
      const parsedLimit = Number(limit);
      if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
        return res.status(400).json({
          success: false,
          message: 'Limit must be an integer between 1 and 100',
        });
      }
      limitNum = parsedLimit;
    }

    const total = await Skill.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNum) || 1;
    const skip = (pageNum - 1) * limitNum;

    const skills = await Skill.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('userId', 'name email college year avatar');

    const skillsWithAvatars = await Promise.all(skills.map(attachSkillAvatar));

    res.status(200).json({
      success: true,
      count: skillsWithAvatars.length,
      total,
      page: pageNum,
      totalPages,
      limit: limitNum,
      skills: skillsWithAvatars,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Create a new skill for the logged-in user
// @route   POST /api/skills
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const createSkill = async (req, res, next) => {
  try {
    // Validate request body via express-validator
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg,
        errors: errors.array(),
      });
    }

    const { name, type, description, category } = req.body;

    // Enforce userId from authenticated token to prevent spoofing
    const skill = await Skill.create({
      userId: req.user._id,
      name,
      type,
      description,
      category,
    });

    await skill.populate('userId', 'name email college year avatar');
    const skillObj = await attachSkillAvatar(skill);

    res.status(201).json({ success: true, skill: skillObj });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update a skill (atomic owner-scoped)
// @route   PUT /api/skills/:id
// @access  Private (owner only)
// ─────────────────────────────────────────────────────────────────────────────
const updateSkill = async (req, res, next) => {
  try {
    // 1. Validate skill ID format before DB operations
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid skill ID format' });
    }

    // 2. Validate request body via express-validator
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg,
        errors: errors.array(),
      });
    }

    const { name, type, description, category } = req.body;
    const updateFields = {};
    if (name !== undefined) updateFields.name = name;
    if (type !== undefined) updateFields.type = type;
    if (description !== undefined) updateFields.description = description;
    if (category !== undefined) updateFields.category = category;

    // 3. Atomic owner-scoped query using both skill ID and authenticated user ID
    const updatedSkill = await Skill.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: updateFields },
      { new: true, runValidators: true }
    ).populate('userId', 'name email college year avatar');

    if (!updatedSkill) {
      const exists = await Skill.exists({ _id: req.params.id });
      if (exists) {
        return res.status(403).json({ success: false, message: 'Not authorized to update this skill' });
      }
      return res.status(404).json({ success: false, message: 'Skill not found' });
    }

    const skillObj = await attachSkillAvatar(updatedSkill);
    res.status(200).json({ success: true, skill: skillObj });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Delete a skill (atomic owner-scoped)
// @route   DELETE /api/skills/:id
// @access  Private (owner only)
// ─────────────────────────────────────────────────────────────────────────────
const deleteSkill = async (req, res, next) => {
  try {
    // 1. Validate skill ID format before DB operations
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid skill ID format' });
    }

    // 2. Atomic owner-scoped delete query using both skill ID and authenticated user ID
    const deletedSkill = await Skill.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!deletedSkill) {
      const exists = await Skill.exists({ _id: req.params.id });
      if (exists) {
        return res.status(403).json({ success: false, message: 'Not authorized to delete this skill' });
      }
      return res.status(404).json({ success: false, message: 'Skill not found' });
    }

    res.status(200).json({ success: true, message: 'Skill deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAllSkills, createSkill, updateSkill, deleteSkill };
