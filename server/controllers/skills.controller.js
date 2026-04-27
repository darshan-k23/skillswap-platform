// controllers/skills.controller.js
// Handles CRUD for Skill documents
const Skill = require('../models/Skill');

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all skills (optionally filtered)
// @route   GET /api/skills
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getAllSkills = async (req, res, next) => {
  try {
    const { type, category, userId, search } = req.query;

    const filter = {};
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (userId) filter.userId = userId;

    let skills = await Skill.find(filter).populate('userId', 'name email college year avatar');

    // Text search on name/description
    if (search) {
      const s = search.toLowerCase();
      skills = skills.filter(
        (sk) =>
          sk.name.toLowerCase().includes(s) ||
          sk.description.toLowerCase().includes(s)
      );
    }

    res.status(200).json({ success: true, count: skills.length, skills });
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
    const { name, type, description, category } = req.body;

    if (!name || !type) {
      return res.status(400).json({ success: false, message: 'Name and type are required' });
    }

    const skill = await Skill.create({
      userId: req.user._id,
      name,
      type,
      description,
      category,
    });

    // Populate user info for response
    await skill.populate('userId', 'name email college year avatar');

    res.status(201).json({ success: true, skill });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update a skill
// @route   PUT /api/skills/:id
// @access  Private (owner only)
// ─────────────────────────────────────────────────────────────────────────────
const updateSkill = async (req, res, next) => {
  try {
    const skill = await Skill.findById(req.params.id);
    if (!skill) {
      return res.status(404).json({ success: false, message: 'Skill not found' });
    }

    if (skill.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this skill' });
    }

    const { name, type, description, category } = req.body;
    const updateFields = {};
    if (name !== undefined) updateFields.name = name;
    if (type !== undefined) updateFields.type = type;
    if (description !== undefined) updateFields.description = description;
    if (category !== undefined) updateFields.category = category;

    const updatedSkill = await Skill.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).populate('userId', 'name email college year avatar');

    res.status(200).json({ success: true, skill: updatedSkill });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Delete a skill
// @route   DELETE /api/skills/:id
// @access  Private (owner only)
// ─────────────────────────────────────────────────────────────────────────────
const deleteSkill = async (req, res, next) => {
  try {
    const skill = await Skill.findById(req.params.id);
    if (!skill) {
      return res.status(404).json({ success: false, message: 'Skill not found' });
    }

    if (skill.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this skill' });
    }

    await skill.deleteOne();

    res.status(200).json({ success: true, message: 'Skill deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAllSkills, createSkill, updateSkill, deleteSkill };
