// controllers/users.controller.js
// Handles: getAllUsers, getUserById, updateUser
const User = require('../models/User');
const Skill = require('../models/Skill');

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all users (for browsing)
// @route   GET /api/users
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getAllUsers = async (req, res, next) => {
  try {
    const { search, college, year } = req.query;

    // Build filter object
    const filter = {};
    if (college) filter.college = { $regex: college, $options: 'i' };
    if (year) filter.year = year;

    let users = await User.find(filter).select('-password');

    // If search query, filter by name or bio
    if (search) {
      const searchLower = search.toLowerCase();
      users = users.filter(
        (u) =>
          u.name.toLowerCase().includes(searchLower) ||
          u.bio.toLowerCase().includes(searchLower)
      );
    }

    // Populate each user's skills
    const usersWithSkills = await Promise.all(
      users.map(async (user) => {
        const skills = await Skill.find({ userId: user._id });
        return { ...user.toObject(), skills };
      })
    );

    res.status(200).json({ success: true, count: usersWithSkills.length, users: usersWithSkills });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get single user by ID
// @route   GET /api/users/:id
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const skills = await Skill.find({ userId: user._id });

    res.status(200).json({ success: true, user: { ...user.toObject(), skills } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update current user's profile
// @route   PUT /api/users/:id
// @access  Private (only own profile)
// ─────────────────────────────────────────────────────────────────────────────
const updateUser = async (req, res, next) => {
  try {
    // Ensure users can only update their own profile
    if (req.params.id !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this profile' });
    }

    // Fields allowed to update (no password change here, no email reassignment)
    const { name, bio, college, year, avatar } = req.body;
    const updateFields = {};
    if (name !== undefined) updateFields.name = name;
    if (bio !== undefined) updateFields.bio = bio;
    if (college !== undefined) updateFields.college = college;
    if (year !== undefined) updateFields.year = year;
    if (avatar !== undefined) updateFields.avatar = avatar;

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({ success: true, user: updatedUser });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAllUsers, getUserById, updateUser };
