// server/utils/validators.js
// Pure helper functions used by the auth, skills and requests controllers.
// They contain no database or network calls, so they are safe to unit test
// inside a CI runner.

const YEARS = ['FE', 'SE', 'TE', 'BE'];
const SKILL_TYPES = ['offer', 'want'];
const REQUEST_STATUSES = ['pending', 'accepted', 'declined'];
const REQUEST_DIRECTIONS = ['sent', 'received'];
const SKILL_CATEGORIES = [
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
];

// Checks the basic shape of a college email id.
function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// The User model only allows these four academic years.
function isValidYear(year) {
  return YEARS.includes(year);
}

// A Skill is either something the student offers or something they want.
function isValidSkillType(type) {
  return SKILL_TYPES.includes(type);
}

// A Skill category must belong to the approved category list.
function isValidSkillCategory(category) {
  return typeof category === 'string' && SKILL_CATEGORIES.includes(category.trim());
}

// Validates whether a value is a valid 24-character hexadecimal MongoDB ObjectId string.
function isValidObjectId(id) {
  return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
}

// Request status must be pending, accepted, or declined.
function isValidRequestStatus(status) {
  return typeof status === 'string' && REQUEST_STATUSES.includes(status);
}

// Request direction must be sent or received.
function isValidRequestDirection(direction) {
  return typeof direction === 'string' && REQUEST_DIRECTIONS.includes(direction);
}

// Mirrors the minimum password length enforced in the User schema.
function isStrongEnoughPassword(password) {
  return typeof password === 'string' && password.length >= 6;
}

// A student must not be able to send a swap request to themselves.
function canSendRequest(senderId, receiverId) {
  if (!senderId || !receiverId) return false;
  return String(senderId) !== String(receiverId);
}

module.exports = {
  YEARS,
  SKILL_TYPES,
  SKILL_CATEGORIES,
  REQUEST_STATUSES,
  REQUEST_DIRECTIONS,
  isValidEmail,
  isValidYear,
  isValidSkillType,
  isValidSkillCategory,
  isValidObjectId,
  isValidRequestStatus,
  isValidRequestDirection,
  isStrongEnoughPassword,
  canSendRequest
};
