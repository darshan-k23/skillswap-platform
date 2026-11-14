// services/s3.service.js
// Handles S3 presigned POST generation, object verification, presigned GET URLs, and cleanup
const crypto = require('crypto');
const { GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { createPresignedPost } = require('@aws-sdk/s3-presigned-post');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { getS3Client, BUCKET_NAME, isS3Configured } = require('../config/s3');

const ALLOWED_MIME_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Validates requested file type and size.
 * @param {string} fileType - MIME type
 * @param {number} fileSize - Size in bytes
 */
const validateUploadMetadata = (fileType, fileSize) => {
  if (!fileType || !ALLOWED_MIME_TYPES[fileType]) {
    const error = new Error('Unsupported image type. Only JPEG, PNG, and WebP are allowed.');
    error.statusCode = 400;
    throw error;
  }

  const numericSize = Number(fileSize);
  if (!numericSize || isNaN(numericSize) || numericSize <= 0) {
    const error = new Error('Invalid file size.');
    error.statusCode = 400;
    throw error;
  }

  if (numericSize > MAX_FILE_SIZE) {
    const error = new Error('File exceeds the maximum allowed size of 5 MB.');
    error.statusCode = 400;
    throw error;
  }
};

/**
 * Generates presigned POST parameters for direct S3 upload with content-length-range enforcement.
 * @param {string} userId - ID of authenticated user
 * @param {string} fileType - MIME type
 * @param {number} fileSize - File size in bytes
 * @returns {Promise<{ uploadUrl: string, fields: object, key: string }>}
 */
const generatePresignedPost = async (userId, fileType, fileSize) => {
  validateUploadMetadata(fileType, fileSize);

  const s3 = getS3Client();
  const ext = ALLOWED_MIME_TYPES[fileType];
  const uniqueId = crypto.randomUUID();
  const key = `avatars/${userId}/${uniqueId}${ext}`;

  const post = await createPresignedPost(s3, {
    Bucket: BUCKET_NAME,
    Key: key,
    Conditions: [
      ['content-length-range', 1, MAX_FILE_SIZE],
      ['eq', '$Content-Type', fileType],
      ['eq', '$key', key],
    ],
    Fields: {
      'Content-Type': fileType,
    },
    Expires: 300, // 5 minutes to complete upload
  });

  return {
    uploadUrl: post.url,
    fields: post.fields,
    key,
  };
};

/**
 * Verifies that the uploaded object exists in S3 and conforms to size and type constraints.
 * @param {string} key - S3 object key
 * @returns {Promise<{ contentLength: number, contentType: string }>}
 */
const verifyUploadedObject = async (key) => {
  const s3 = getS3Client();

  try {
    const headCommand = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });
    const headResult = await s3.send(headCommand);

    if (headResult.ContentLength > MAX_FILE_SIZE) {
      await deleteS3Object(key).catch(() => {});
      const error = new Error('Uploaded file exceeds the 5 MB limit.');
      error.statusCode = 400;
      throw error;
    }

    if (!ALLOWED_MIME_TYPES[headResult.ContentType]) {
      await deleteS3Object(key).catch(() => {});
      const error = new Error('Uploaded file type is not supported.');
      error.statusCode = 400;
      throw error;
    }

    return {
      contentLength: headResult.ContentLength,
      contentType: headResult.ContentType,
    };
  } catch (err) {
    if (err.statusCode) throw err;
    const error = new Error('Uploaded file could not be verified in storage. Please try uploading again.');
    error.statusCode = 400;
    error.originalError = err.message;
    throw error;
  }
};

/**
 * Deletes an object from S3.
 * @param {string} key - S3 object key
 */
const deleteS3Object = async (key) => {
  if (!key || typeof key !== 'string') return;
  // Only delete S3 keys managed by our app
  if (!key.startsWith('avatars/')) return;

  try {
    const s3 = getS3Client();
    const deleteCommand = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });
    await s3.send(deleteCommand);
  } catch (err) {
    console.warn(`[S3 Cleanup Warning] Could not delete object ${key}:`, err.message);
  }
};

/**
 * Resolves an avatar string to a usable URL.
 * If S3 object key, generates a presigned GET URL (1 hour validity).
 * If external URL (http/https/data) or empty, returns as is.
 * @param {string} avatarKeyOrUrl
 * @returns {Promise<string>}
 */
const resolveAvatarUrl = async (avatarKeyOrUrl) => {
  if (!avatarKeyOrUrl || typeof avatarKeyOrUrl !== 'string') {
    return '';
  }

  // Preserve external URLs and data URIs for backward compatibility
  if (
    avatarKeyOrUrl.startsWith('http://') ||
    avatarKeyOrUrl.startsWith('https://') ||
    avatarKeyOrUrl.startsWith('data:')
  ) {
    return avatarKeyOrUrl;
  }

  // Only attempt S3 presigned GET if avatarKeyOrUrl looks like an S3 key
  if (avatarKeyOrUrl.startsWith('avatars/')) {
    if (!isS3Configured()) {
      return avatarKeyOrUrl;
    }

    try {
      const s3 = getS3Client();
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: avatarKeyOrUrl,
      });
      return await getSignedUrl(s3, command, { expiresIn: 3600 });
    } catch (err) {
      console.warn(`[S3 Presign GET Warning] Failed to presign URL for ${avatarKeyOrUrl}:`, err.message);
      return avatarKeyOrUrl;
    }
  }

  return avatarKeyOrUrl;
};

/**
 * Attaches a resolved avatar URL to a user object or Mongoose document.
 * @param {object} user - User document or object
 * @returns {Promise<object>}
 */
const attachAvatarUrl = async (user) => {
  if (!user) return user;
  const userObj = typeof user.toObject === 'function' ? user.toObject() : { ...user };
  if (userObj.avatar) {
    userObj.avatar = await resolveAvatarUrl(userObj.avatar);
  }
  return userObj;
};

/**
 * Attaches resolved avatar URLs to an array of user objects.
 * @param {Array<object>} users
 * @returns {Promise<Array<object>>}
 */
const attachAvatarUrls = async (users) => {
  if (!Array.isArray(users)) return users;
  return Promise.all(users.map((u) => attachAvatarUrl(u)));
};

/**
 * Attaches resolved avatar URL to populated skill.userId if present.
 * @param {object} skill
 * @returns {Promise<object>}
 */
const attachSkillAvatar = async (skill) => {
  if (!skill) return skill;
  const skillObj = typeof skill.toObject === 'function' ? skill.toObject() : { ...skill };
  if (skillObj.userId && typeof skillObj.userId === 'object') {
    skillObj.userId = await attachAvatarUrl(skillObj.userId);
  }
  return skillObj;
};

/**
 * Attaches resolved avatar URLs to populated senderId and receiverId on request.
 * @param {object} request
 * @returns {Promise<object>}
 */
const attachRequestAvatars = async (request) => {
  if (!request) return request;
  const reqObj = typeof request.toObject === 'function' ? request.toObject() : { ...request };
  if (reqObj.senderId && typeof reqObj.senderId === 'object') {
    reqObj.senderId = await attachAvatarUrl(reqObj.senderId);
  }
  if (reqObj.receiverId && typeof reqObj.receiverId === 'object') {
    reqObj.receiverId = await attachAvatarUrl(reqObj.receiverId);
  }
  return reqObj;
};

module.exports = {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  validateUploadMetadata,
  generatePresignedPost,
  verifyUploadedObject,
  deleteS3Object,
  resolveAvatarUrl,
  attachAvatarUrl,
  attachAvatarUrls,
  attachSkillAvatar,
  attachRequestAvatars,
};
