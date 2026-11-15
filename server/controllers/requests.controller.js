// controllers/requests.controller.js
// Handles CRUD for Exchange Request documents
const { validationResult } = require('express-validator');
const Request = require('../models/Request');
const User = require('../models/User');
const Skill = require('../models/Skill');
const { attachRequestAvatars } = require('../services/s3.service');
const {
  isValidObjectId,
  isValidRequestStatus,
  isValidRequestDirection,
} = require('../utils/validators');

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all requests involving the logged-in user (paginated)
// @route   GET /api/requests
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getRequests = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // 1. Validate query parameters as primitive strings to prevent operator injection
    for (const key of Object.keys(req.query)) {
      if (typeof req.query[key] !== 'string') {
        return res.status(400).json({
          success: false,
          message: `Query parameter '${key}' must be a string`,
        });
      }
    }

    const { status, direction, page, limit } = req.query;

    let filter = {
      $or: [{ senderId: userId }, { receiverId: userId }],
    };

    // Filter by direction: sent or received
    if (direction !== undefined) {
      if (!isValidRequestDirection(direction)) {
        return res.status(400).json({
          success: false,
          message: `Direction must be either 'sent' or 'received'`,
        });
      }
      if (direction === 'sent') filter = { senderId: userId };
      if (direction === 'received') filter = { receiverId: userId };
    }

    // Filter by status: pending, accepted, or declined
    if (status !== undefined) {
      if (!isValidRequestStatus(status)) {
        return res.status(400).json({
          success: false,
          message: `Status must be pending, accepted, or declined`,
        });
      }
      filter.status = status;
    }

    // Pagination validation (defaults: page 1, limit 20, max limit 100)
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

    const total = await Request.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNum) || 1;
    const skip = (pageNum - 1) * limitNum;

    const requests = await Request.find(filter)
      .populate('senderId', 'name email avatar college year')
      .populate('receiverId', 'name email avatar college year')
      .populate('offeredSkillId', 'name type category description')
      .populate('wantedSkillId', 'name type category description')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const requestsWithAvatars = await Promise.all(requests.map(attachRequestAvatars));

    res.status(200).json({
      success: true,
      count: requestsWithAvatars.length,
      total,
      page: pageNum,
      totalPages,
      limit: limitNum,
      requests: requestsWithAvatars,
    });
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
    // 1. Validate request body via express-validator
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg,
        errors: errors.array(),
      });
    }

    const { receiverId, offeredSkillId, wantedSkillId, message } = req.body;

    if (!receiverId || !offeredSkillId || !wantedSkillId) {
      return res.status(400).json({
        success: false,
        message: 'receiverId, offeredSkillId and wantedSkillId are required',
      });
    }

    // 2. Validate ObjectIds before database operations
    if (!isValidObjectId(receiverId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid receiverId format. Must be a 24-character hexadecimal ObjectId',
      });
    }
    if (!isValidObjectId(offeredSkillId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid offeredSkillId format. Must be a 24-character hexadecimal ObjectId',
      });
    }
    if (!isValidObjectId(wantedSkillId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wantedSkillId format. Must be a 24-character hexadecimal ObjectId',
      });
    }

    // 3. Can't send request to yourself
    if (req.user._id.toString() === receiverId.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot send request to yourself' });
    }

    // 4. Verify receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ success: false, message: 'Receiver not found' });
    }

    // 5. Verify offered skill belongs to sender and has type 'offer'
    const offeredSkill = await Skill.findById(offeredSkillId);
    if (!offeredSkill || offeredSkill.userId.toString() !== req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Invalid offered skill' });
    }
    if (offeredSkill.type !== 'offer') {
      return res.status(400).json({ success: false, message: "Offered skill must have type 'offer'" });
    }

    // 6. Verify wanted skill belongs to receiver and has type 'offer'
    const wantedSkill = await Skill.findById(wantedSkillId);
    if (!wantedSkill || wantedSkill.userId.toString() !== receiverId.toString()) {
      return res.status(400).json({ success: false, message: 'Invalid wanted skill' });
    }
    if (wantedSkill.type !== 'offer') {
      return res.status(400).json({ success: false, message: "Wanted skill must have type 'offer'" });
    }

    // 7. Check for duplicate request
    const existing = await Request.findOne({
      senderId: req.user._id,
      receiverId,
      offeredSkillId,
      wantedSkillId,
    });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Request already sent for this skill pair' });
    }

    // 8. Create request deriving senderId exclusively from authenticated token
    const request = await Request.create({
      senderId: req.user._id,
      receiverId,
      offeredSkillId,
      wantedSkillId,
      message: typeof message === 'string' ? message.trim() : '',
    });

    await request.populate([
      { path: 'senderId', select: 'name email avatar college year' },
      { path: 'receiverId', select: 'name email avatar college year' },
      { path: 'offeredSkillId', select: 'name type category description' },
      { path: 'wantedSkillId', select: 'name type category description' },
    ]);

    const requestObj = await attachRequestAvatars(request);

    res.status(201).json({ success: true, request: requestObj });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update request status (atomic accept / decline by receiver)
// @route   PUT /api/requests/:id
// @access  Private (receiver only)
// ─────────────────────────────────────────────────────────────────────────────
const updateRequest = async (req, res, next) => {
  try {
    // 1. Validate request body and params via express-validator
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg,
        errors: errors.array(),
      });
    }

    // 2. Validate request ID format
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid request ID format' });
    }

    const { status } = req.body;

    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be "accepted" or "declined"' });
    }

    // 3. Atomic conditional update: only receiver can respond, and only pending requests can be updated
    const updatedRequest = await Request.findOneAndUpdate(
      {
        _id: req.params.id,
        receiverId: req.user._id,
        status: 'pending',
      },
      { $set: { status } },
      { new: true, runValidators: true }
    ).populate([
      { path: 'senderId', select: 'name email avatar college year' },
      { path: 'receiverId', select: 'name email avatar college year' },
      { path: 'offeredSkillId', select: 'name type category description' },
      { path: 'wantedSkillId', select: 'name type category description' },
    ]);

    if (!updatedRequest) {
      // Differentiate why the atomic update failed
      const existing = await Request.findById(req.params.id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Request not found' });
      }

      if (existing.receiverId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Only the receiver can update this request' });
      }

      if (existing.status !== 'pending') {
        return res.status(400).json({ success: false, message: 'Request has already been responded to' });
      }

      return res.status(409).json({ success: false, message: 'Request state changed concurrently' });
    }

    const requestObj = await attachRequestAvatars(updatedRequest);

    res.status(200).json({ success: true, request: requestObj });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Cancel/delete a pending request (atomic sender-only)
// @route   DELETE /api/requests/:id
// @access  Private (sender only, pending requests)
// ─────────────────────────────────────────────────────────────────────────────
const deleteRequest = async (req, res, next) => {
  try {
    // 1. Validate params via express-validator
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg,
        errors: errors.array(),
      });
    }

    // 2. Validate request ID format
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid request ID format' });
    }

    // 2. Atomic conditional delete: only sender can cancel, and only while status is pending
    const deletedRequest = await Request.findOneAndDelete({
      _id: req.params.id,
      senderId: req.user._id,
      status: 'pending',
    });

    if (!deletedRequest) {
      // Differentiate why the atomic delete failed
      const existing = await Request.findById(req.params.id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Request not found' });
      }

      if (existing.senderId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Only the sender can delete this request' });
      }

      if (existing.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: `Cannot cancel a request that has already been ${existing.status}`,
        });
      }

      return res.status(409).json({ success: false, message: 'Request state changed concurrently' });
    }

    res.status(200).json({ success: true, message: 'Request deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getRequests, createRequest, updateRequest, deleteRequest };
