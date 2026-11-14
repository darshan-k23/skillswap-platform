// controllers/users.controller.js
// Handles: getAllUsers, getUserById, updateUser, requestAvatarUpload, confirmAvatarUpload, deleteAvatar
const User = require('../models/User');
const Skill = require('../models/Skill');
const {
  ALLOWED_MIME_TYPES,
  generatePresignedPost,
  verifyUploadedObject,
  deleteS3Object,
  resolveAvatarUrl,
  attachAvatarUrl,
} = require('../services/s3.service');

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

    // Populate each user's skills and resolve avatar URLs
    const usersWithSkills = await Promise.all(
      users.map(async (user) => {
        const skills = await Skill.find({ userId: user._id });
        const userObj = await attachAvatarUrl(user);
        return { ...userObj, skills };
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
    const userObj = await attachAvatarUrl(user);

    res.status(200).json({ success: true, user: { ...userObj, skills } });
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

    const userObj = await attachAvatarUrl(updatedUser);

    res.status(200).json({ success: true, user: userObj });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Request presigned upload parameters for user avatar
// @route   POST /api/users/:id/avatar/upload-request
// @access  Private (only own profile)
// ─────────────────────────────────────────────────────────────────────────────
const requestAvatarUpload = async (req, res, next) => {
  try {
    if (req.params.id !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this profile' });
    }

    const { fileType, fileSize } = req.body;
    if (!fileType || !fileSize) {
      return res.status(400).json({
        success: false,
        message: 'fileType and fileSize are required',
      });
    }

    const uploadPolicy = await generatePresignedPost(req.user._id.toString(), fileType, fileSize);

    res.status(200).json({
      success: true,
      uploadUrl: uploadPolicy.uploadUrl,
      fields: uploadPolicy.fields,
      key: uploadPolicy.key,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Confirm avatar upload, verify object in S3, update user and clean up old avatar
// @route   POST /api/users/:id/avatar/confirm
// @access  Private (only own profile)
// ─────────────────────────────────────────────────────────────────────────────
const confirmAvatarUpload = async (req, res, next) => {
  try {
    if (req.params.id !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this profile' });
    }

    const { key } = req.body;
    if (!key || typeof key !== 'string' || !key.trim()) {
      return res.status(400).json({ success: false, message: 'Object key is required' });
    }

    // Security check: Key must reside under avatars/{userId}/{uniqueId}.{ext}
    const expectedPrefix = `avatars/${req.user._id.toString()}/`;
    if (!key.startsWith(expectedPrefix) || key.length <= expectedPrefix.length) {
      return res.status(400).json({ success: false, message: 'Invalid object key location for this account' });
    }

    const hasValidExtension = Object.values(ALLOWED_MIME_TYPES).some((ext) => key.endsWith(ext));
    if (!hasValidExtension) {
      return res.status(400).json({ success: false, message: 'Invalid object key extension' });
    }

    // Step 7: Verify uploaded object using HeadObject
    await verifyUploadedObject(key);

    const user = await User.findById(req.user._id);
    if (!user) {
      // Clean up orphaned S3 object if user suddenly doesn't exist
      await deleteS3Object(key).catch(() => {});
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const previousAvatar = user.avatar;
    user.avatar = key;

    try {
      await user.save();
    } catch (saveError) {
      // Step G: If database update fails, delete new S3 object so it does not remain orphaned
      await deleteS3Object(key).catch(() => {});
      throw saveError;
    }

    // Step 9: Delete previous S3 object after successful replacement
    if (previousAvatar && previousAvatar.startsWith('avatars/') && previousAvatar !== key) {
      await deleteS3Object(previousAvatar);
    }

    const avatarUrl = await resolveAvatarUrl(key);
    const userObj = { ...user.toObject(), avatar: avatarUrl };
    delete userObj.password;

    res.status(200).json({
      success: true,
      message: 'Avatar updated successfully',
      avatarUrl,
      user: userObj,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Delete user avatar and revert to initials
// @route   DELETE /api/users/:id/avatar
// @access  Private (only own profile)
// ─────────────────────────────────────────────────────────────────────────────
const deleteAvatar = async (req, res, next) => {
  try {
    if (req.params.id !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this profile' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const previousAvatar = user.avatar;
    user.avatar = '';
    await user.save();

    if (previousAvatar && previousAvatar.startsWith('avatars/')) {
      await deleteS3Object(previousAvatar);
    }

    const userObj = user.toObject();
    delete userObj.password;

    res.status(200).json({
      success: true,
      message: 'Avatar removed successfully',
      user: userObj,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
  requestAvatarUpload,
  confirmAvatarUpload,
  deleteAvatar,
};
