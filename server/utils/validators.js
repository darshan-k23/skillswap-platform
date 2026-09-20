// server/utils/validators.js
// Pure helper functions used by the auth, skills and requests controllers.
// They contain no database or network calls, so they are safe to unit test
// inside a CI runner.

const YEARS = ['FE', 'SE', 'TE', 'BE'];
const SKILL_TYPES = ['offer', 'want'];

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
  isValidEmail,
  isValidYear,
  isValidSkillType,
  isStrongEnoughPassword,
  canSendRequest
};
