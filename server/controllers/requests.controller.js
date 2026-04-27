// controllers/requests.controller.js
// Handles CRUD for Exchange Request documents
const Request = require('../models/Request');
const User = require('../models/User');
const Skill = require('../models/Skill');

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all requests involving the logged-in user
// @route   GET /api/requests
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getRequests = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { status, direction } = req.query;

    let filter = {
      $or: [{ senderId: userId }, { receiverId: userId }],
    };

    // Filter by direction: sent or received
    if (direction === 'sent') filter = { senderId: userId };
    if (direction === 'received') filter = { receiverId: userId };

    if (status) filter.status = status;

    const requests = await Request.find(filter)
      .populate('senderId', 'name email avatar college year')
      .populate('receiverId', 'name email avatar college year')
      .populate('offeredSkillId', 'name type category description')
      .populate('wantedSkillId', 'name type category description')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: requests.length, requests });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Create a new exchange request
// @route   POST /api/requests
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const createRequest = async (req, res, next) => {
  try {
    const { receiverId, offeredSkillId, wantedSkillId, message } = req.body;

    if (!receiverId || !offeredSkillId || !wantedSkillId) {
      return res.status(400).json({
        success: false,
        message: 'receiverId, offeredSkillId and wantedSkillId are required',
      });
    }

    // Can't send request to yourself
    if (req.user._id.toString() === receiverId) {
      return res.status(400).json({ success: false, message: 'Cannot send request to yourself' });
    }

    // Verify receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ success: false, message: 'Receiver not found' });
    }

    // Verify offered skill belongs to sender
    const offeredSkill = await Skill.findById(offeredSkillId);
    if (!offeredSkill || offeredSkill.userId.toString() !== req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Invalid offered skill' });
    }

    // Verify wanted skill belongs to receiver
    const wantedSkill = await Skill.findById(wantedSkillId);
    if (!wantedSkill || wantedSkill.userId.toString() !== receiverId) {
      return res.status(400).json({ success: false, message: 'Invalid wanted skill' });
    }

    // Check for duplicate request
    const existing = await Request.findOne({
      senderId: req.user._id,
      receiverId,
      offeredSkillId,
      wantedSkillId,
    });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Request already sent for this skill pair' });
    }

    const request = await Request.create({
      senderId: req.user._id,
      receiverId,
      offeredSkillId,
      wantedSkillId,
      message,
    });

    await request.populate([
      { path: 'senderId', select: 'name email avatar college year' },
      { path: 'receiverId', select: 'name email avatar college year' },
      { path: 'offeredSkillId', select: 'name type category description' },
      { path: 'wantedSkillId', select: 'name type category description' },
    ]);

    res.status(201).json({ success: true, request });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update request status (accept / decline)
// @route   PUT /api/requests/:id
// @access  Private (receiver only)
// ─────────────────────────────────────────────────────────────────────────────
const updateRequest = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be "accepted" or "declined"' });
    }

    const request = await Request.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    // Only the receiver can accept/decline
    if (request.receiverId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the receiver can update this request' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Request has already been responded to' });
    }

    request.status = status;
    await request.save();

    await request.populate([
      { path: 'senderId', select: 'name email avatar college year' },
      { path: 'receiverId', select: 'name email avatar college year' },
      { path: 'offeredSkillId', select: 'name type category description' },
      { path: 'wantedSkillId', select: 'name type category description' },
    ]);

    res.status(200).json({ success: true, request });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Delete a request
// @route   DELETE /api/requests/:id
// @access  Private (sender only, pending requests)
// ─────────────────────────────────────────────────────────────────────────────
const deleteRequest = async (req, res, next) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    if (request.senderId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the sender can delete this request' });
    }

    await request.deleteOne();

    res.status(200).json({ success: true, message: 'Request deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getRequests, createRequest, updateRequest, deleteRequest };
