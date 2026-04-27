// models/Request.js
// Mongoose schema for Exchange Request document
const mongoose = require('mongoose');

const RequestSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender ID is required'],
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Receiver ID is required'],
    },
    offeredSkillId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Skill',
      required: [true, 'Offered skill ID is required'],
    },
    wantedSkillId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Skill',
      required: [true, 'Wanted skill ID is required'],
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'accepted', 'declined'],
        message: 'Status must be pending, accepted, or declined',
      },
      default: 'pending',
    },
    message: {
      type: String,
      trim: true,
      maxlength: [300, 'Message cannot exceed 300 characters'],
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate requests (same sender → receiver + same skill pair)
RequestSchema.index(
  { senderId: 1, receiverId: 1, offeredSkillId: 1, wantedSkillId: 1 },
  { unique: true }
);

module.exports = mongoose.model('Request', RequestSchema);
