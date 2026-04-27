// models/Skill.js
// Mongoose schema for Skill document
const mongoose = require('mongoose');

const SkillSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    name: {
      type: String,
      required: [true, 'Skill name is required'],
      trim: true,
      minlength: [2, 'Skill name must be at least 2 characters'],
      maxlength: [60, 'Skill name cannot exceed 60 characters'],
    },
    type: {
      type: String,
      enum: {
        values: ['offer', 'want'],
        message: 'Skill type must be either "offer" or "want"',
      },
      required: [true, 'Skill type is required'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, 'Description cannot exceed 200 characters'],
      default: '',
    },
    category: {
      type: String,
      trim: true,
      default: 'General',
      enum: [
        'Programming',
        'Design',
        'Music',
        'Sports',
        'Language',
        'Math',
        'Science',
        'Art',
        'Writing',
        'General',
        'Other',
      ],
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster lookups by user and type
SkillSchema.index({ userId: 1, type: 1 });
SkillSchema.index({ name: 'text', description: 'text' }); // Text search

module.exports = mongoose.model('Skill', SkillSchema);
