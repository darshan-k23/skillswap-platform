// config/s3.js
// Reusable AWS S3 configuration module for SkillSwap
const { S3Client } = require('@aws-sdk/client-s3');

const REGION = process.env.AWS_REGION || 'us-east-1';

// Internal cached client instance
let s3ClientInstance = null;

/**
 * Checks if S3 environment variables are sufficiently configured.
 * Requires AWS_S3_BUCKET_NAME to be explicitly configured.
 * @returns {boolean}
 */
const isS3Configured = () => {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_S3_BUCKET_NAME
  );
};

/**
 * Validates S3 configuration and throws a clear server-side configuration error if missing.
 */
const checkS3Config = () => {
  const missing = [];
  if (!process.env.AWS_ACCESS_KEY_ID) missing.push('AWS_ACCESS_KEY_ID');
  if (!process.env.AWS_SECRET_ACCESS_KEY) missing.push('AWS_SECRET_ACCESS_KEY');
  if (!process.env.AWS_S3_BUCKET_NAME) missing.push('AWS_S3_BUCKET_NAME');

  if (missing.length > 0) {
    const error = new Error(`AWS S3 configuration incomplete. Missing required environment variables: ${missing.join(', ')}`);
    error.status = 500;
    throw error;
  }
};

/**
 * Instantiates and returns an S3Client instance.
 * Supports temporary AWS Academy credentials via AWS_SESSION_TOKEN.
 * @param {object} [customConfig] - Optional override config (useful for testing)
 * @returns {S3Client}
 */
const getS3Client = (customConfig = {}) => {
  if (customConfig && Object.keys(customConfig).length > 0) {
    return new S3Client(customConfig);
  }

  if (s3ClientInstance) {
    return s3ClientInstance;
  }

  checkS3Config();

  const credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };

  // AWS Academy Learner Lab temporary credentials require AWS_SESSION_TOKEN
  if (process.env.AWS_SESSION_TOKEN) {
    credentials.sessionToken = process.env.AWS_SESSION_TOKEN;
  }

  s3ClientInstance = new S3Client({
    region: process.env.AWS_REGION || REGION,
    credentials,
  });

  return s3ClientInstance;
};

/**
 * Override the client instance (primarily for automated unit tests)
 * @param {S3Client|null} mockClient
 */
const setS3Client = (mockClient) => {
  s3ClientInstance = mockClient;
};

module.exports = {
  get BUCKET_NAME() {
    return process.env.AWS_S3_BUCKET_NAME || '';
  },
  REGION,
  isS3Configured,
  checkS3Config,
  getS3Client,
  setS3Client,
};
