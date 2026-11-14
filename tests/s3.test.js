// tests/s3.test.js
// Automated tests for AWS S3 Avatar Integration
// Uses Node.js built-in test runner (node:test) with mocked AWS operations.
const test = require('node:test');
const assert = require('node:assert');
const { S3Client } = require('@aws-sdk/client-s3');
const { getS3Client, setS3Client, isS3Configured, checkS3Config } = require('../server/config/s3');
const User = require('../server/models/User');

const {
  requestAvatarUpload,
  confirmAvatarUpload,
  deleteAvatar,
} = require('../server/controllers/users.controller');
const {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  validateUploadMetadata,
  generatePresignedPost,
  verifyUploadedObject,
  deleteS3Object,
  resolveAvatarUrl,
  attachAvatarUrl,
  attachSkillAvatar,
  attachRequestAvatars,
} = require('../server/services/s3.service');

// ── Test 1: Upload metadata validation ─────────────────────────────────────────
test('supports only JPEG, PNG, and WebP formats', () => {
  assert.doesNotThrow(() => validateUploadMetadata('image/jpeg', 1024));
  assert.doesNotThrow(() => validateUploadMetadata('image/png', 2048));
  assert.doesNotThrow(() => validateUploadMetadata('image/webp', 4096));

  assert.throws(
    () => validateUploadMetadata('image/gif', 1024),
    /Unsupported image type/
  );
  assert.throws(
    () => validateUploadMetadata('application/pdf', 1024),
    /Unsupported image type/
  );
  assert.throws(
    () => validateUploadMetadata('image/svg+xml', 1024),
    /Unsupported image type/
  );
});

test('enforces 5 MB maximum file size constraint', () => {
  const fiveMB = 5 * 1024 * 1024;
  assert.doesNotThrow(() => validateUploadMetadata('image/jpeg', fiveMB));

  assert.throws(
    () => validateUploadMetadata('image/jpeg', fiveMB + 1),
    /File exceeds the maximum allowed size of 5 MB/
  );
  assert.throws(
    () => validateUploadMetadata('image/jpeg', 0),
    /Invalid file size/
  );
  assert.throws(
    () => validateUploadMetadata('image/jpeg', -100),
    /Invalid file size/
  );
  assert.throws(
    () => validateUploadMetadata('image/jpeg', NaN),
    /Invalid file size/
  );
});

// ── Test 2: Backward compatibility of existing avatar URLs ───────────────────
test('existing external HTTP, HTTPS, and data URLs remain untouched', async () => {
  const httpsUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb';
  const httpUrl = 'http://example.com/avatar.png';
  const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  assert.strictEqual(await resolveAvatarUrl(httpsUrl), httpsUrl);
  assert.strictEqual(await resolveAvatarUrl(httpUrl), httpUrl);
  assert.strictEqual(await resolveAvatarUrl(dataUri), dataUri);
  assert.strictEqual(await resolveAvatarUrl(''), '');
  assert.strictEqual(await resolveAvatarUrl(null), '');
});

// ── Test 3: S3 presigned POST generation with mocked S3 client ────────────────
test('presigned upload request creates secure random key under avatars/{userId}/', async () => {
  const userId = '64f1a2b3c4d5e6f7a8b9c0d1';

  // Use S3Client instance with mock credentials for local presigned POST calculation
  const mockS3 = new S3Client({
    region: 'us-east-1',
    credentials: {
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    },
  });
  setS3Client(mockS3);

  const result = await generatePresignedPost(userId, 'image/png', 50000);

  assert.ok(result.uploadUrl, 'Must return uploadUrl');
  assert.ok(result.fields, 'Must return presigned fields');
  assert.ok(result.key, 'Must return object key');

  // Verify key structure: avatars/{userId}/{uuid}.png
  assert.ok(result.key.startsWith(`avatars/${userId}/`), 'Key must start with avatars/{userId}/');
  assert.ok(result.key.endsWith('.png'), 'Key must end with .png extension');
  assert.notStrictEqual(result.key, `avatars/${userId}/avatar.png`, 'Must not use a static or user-supplied filename');
});

// ── Test 4: S3 HeadObject verification and rejection ──────────────────────────
test('verifies uploaded object size and content type via HeadObject', async () => {
  const validKey = 'avatars/user123/valid.jpg';

  // Mock S3 send responding to HeadObjectCommand
  const mockS3 = {
    send: async (command) => {
      if (command.constructor.name === 'HeadObjectCommand') {
        return {
          ContentLength: 1024 * 500, // 500 KB
          ContentType: 'image/jpeg',
          ETag: '"mock-etag"',
        };
      }
      return {};
    },
  };
  setS3Client(mockS3);

  const verification = await verifyUploadedObject(validKey);
  assert.strictEqual(verification.contentLength, 512000);
  assert.strictEqual(verification.contentType, 'image/jpeg');
});

test('rejects and cleans up S3 objects that exceed 5 MB on HeadObject', async () => {
  const oversizedKey = 'avatars/user123/large.jpg';
  let deletedKey = null;

  const mockS3 = {
    send: async (command) => {
      if (command.constructor.name === 'HeadObjectCommand') {
        return {
          ContentLength: 6 * 1024 * 1024, // 6 MB (oversized)
          ContentType: 'image/jpeg',
        };
      }
      if (command.constructor.name === 'DeleteObjectCommand') {
        deletedKey = command.input.Key;
        return {};
      }
      return {};
    },
  };
  setS3Client(mockS3);

  await assert.rejects(
    () => verifyUploadedObject(oversizedKey),
    /Uploaded file exceeds the 5 MB limit/
  );

  assert.strictEqual(deletedKey, oversizedKey, 'Oversized file must be deleted from S3');
});

test('rejects and cleans up S3 objects with unsupported ContentType on HeadObject', async () => {
  const invalidKey = 'avatars/user123/file.exe';
  let deletedKey = null;

  const mockS3 = {
    send: async (command) => {
      if (command.constructor.name === 'HeadObjectCommand') {
        return {
          ContentLength: 1024,
          ContentType: 'application/x-msdownload',
        };
      }
      if (command.constructor.name === 'DeleteObjectCommand') {
        deletedKey = command.input.Key;
        return {};
      }
      return {};
    },
  };
  setS3Client(mockS3);

  await assert.rejects(
    () => verifyUploadedObject(invalidKey),
    /Uploaded file type is not supported/
  );

  assert.strictEqual(deletedKey, invalidKey, 'Invalid file type must be deleted from S3');
});

// ── Test 5: Populated entity avatar resolution ────────────────────────────────
test('attachSkillAvatar and attachRequestAvatars resolve nested user avatars', async () => {
  const skill = {
    _id: 'skill123',
    name: 'React',
    userId: {
      _id: 'user123',
      name: 'Darshan',
      avatar: 'https://cdn.example.com/profile.jpg',
    },
  };

  const resolvedSkill = await attachSkillAvatar(skill);
  assert.strictEqual(resolvedSkill.userId.avatar, 'https://cdn.example.com/profile.jpg');

  const request = {
    _id: 'req123',
    senderId: {
      _id: 'user1',
      name: 'Alice',
      avatar: 'https://cdn.example.com/alice.jpg',
    },
    receiverId: {
      _id: 'user2',
      name: 'Bob',
      avatar: '',
    },
  };

  const resolvedReq = await attachRequestAvatars(request);
  assert.strictEqual(resolvedReq.senderId.avatar, 'https://cdn.example.com/alice.jpg');
  assert.strictEqual(resolvedReq.receiverId.avatar, '');
});

// ── Test 6: Safe S3 object deletion ───────────────────────────────────────────
test('deleteS3Object safely ignores non-S3 URLs and empty keys', async () => {
  let deleteCalled = false;
  const mockS3 = {
    send: async (command) => {
      if (command.constructor.name === 'DeleteObjectCommand') {
        deleteCalled = true;
      }
      return {};
    },
  };
  setS3Client(mockS3);

  await deleteS3Object('https://images.unsplash.com/photo');
  assert.strictEqual(deleteCalled, false, 'Must not attempt to delete external URLs');

  await deleteS3Object('');
  assert.strictEqual(deleteCalled, false, 'Must not attempt to delete empty keys');

  await deleteS3Object('avatars/user123/test.jpg');
  assert.strictEqual(deleteCalled, true, 'Must delete S3 keys with avatars/ prefix');
});

// ── Test 7: Controller Authorization & Security Checks ────────────────────────
test('requestAvatarUpload rejects requests from users trying to modify another account', async () => {
  const req = {
    params: { id: 'targetUser456' },
    user: { _id: 'authenticatedUser123' },
    body: { fileType: 'image/jpeg', fileSize: 1024 },
  };

  let statusCode = null;
  let jsonResponse = null;
  const res = {
    status: (code) => {
      statusCode = code;
      return {
        json: (data) => {
          jsonResponse = data;
        },
      };
    },
  };

  await requestAvatarUpload(req, res, () => {});
  assert.strictEqual(statusCode, 403, 'Must return 403 Forbidden');
  assert.strictEqual(jsonResponse.success, false);
  assert.match(jsonResponse.message, /Not authorized/);
});

test('confirmAvatarUpload rejects unauthorized accounts and mismatched key prefixes', async () => {
  // Test mismatched account ID
  const reqUnauthorized = {
    params: { id: 'userB' },
    user: { _id: 'userA' },
    body: { key: 'avatars/userA/image.png' },
  };

  let statusCode = null;
  let jsonResponse = null;
  const res = {
    status: (code) => {
      statusCode = code;
      return {
        json: (data) => {
          jsonResponse = data;
        },
      };
    },
  };

  await confirmAvatarUpload(reqUnauthorized, res, () => {});
  assert.strictEqual(statusCode, 403, 'Must return 403 for mismatched user account');

  // Test spoofed key belonging to another user's directory
  const reqSpoofedKey = {
    params: { id: 'userA' },
    user: { _id: 'userA' },
    body: { key: 'avatars/victimUser/private.jpg' },
  };

  await confirmAvatarUpload(reqSpoofedKey, res, () => {});
  assert.strictEqual(statusCode, 400, 'Must return 400 for key outside avatars/{userId}/');
  assert.match(jsonResponse.message, /Invalid object key location/);
});

test('deleteAvatar rejects attempts to delete avatar of another user', async () => {
  const req = {
    params: { id: 'otherUser' },
    user: { _id: 'currentUser' },
  };

  let statusCode = null;
  const res = {
    status: (code) => {
      statusCode = code;
      return {
        json: () => {},
      };
    },
  };

  await deleteAvatar(req, res, () => {});
  assert.strictEqual(statusCode, 403, 'Must return 403 Forbidden');
});

// ── Test 8: Additional Phase 1 Corrections Test Suite ─────────────────────────

// 1. AWS_SESSION_TOKEN is correctly included in S3 client credentials
test('AWS_SESSION_TOKEN is correctly included in S3 client credentials', async () => {
  const originalEnv = { ...process.env };
  try {
    process.env.AWS_ACCESS_KEY_ID = 'ASI_MOCK_KEY';
    process.env.AWS_SECRET_ACCESS_KEY = 'MOCK_SECRET_KEY';
    process.env.AWS_SESSION_TOKEN = 'MOCK_ACADEMY_SESSION_TOKEN';
    process.env.AWS_S3_BUCKET_NAME = 'mock-test-bucket';
    process.env.AWS_REGION = 'us-east-1';

    setS3Client(null); // Reset cached client
    const client = getS3Client();
    const creds = await client.config.credentials();

    assert.strictEqual(creds.accessKeyId, 'ASI_MOCK_KEY');
    assert.strictEqual(creds.secretAccessKey, 'MOCK_SECRET_KEY');
    assert.strictEqual(creds.sessionToken, 'MOCK_ACADEMY_SESSION_TOKEN');
  } finally {
    process.env = originalEnv;
    setS3Client(null);
  }
});

// 2. MongoDB persistence failure during avatar confirmation triggers cleanup of the newly uploaded S3 object
test('MongoDB persistence failure during avatar confirmation triggers cleanup of the newly uploaded S3 object', async () => {
  const originalFindById = User.findById;
  const deletedKeys = [];

  const mockS3 = {
    send: async (command) => {
      if (command.constructor.name === 'HeadObjectCommand') {
        return { ContentLength: 2048, ContentType: 'image/png' };
      }
      if (command.constructor.name === 'DeleteObjectCommand') {
        deletedKeys.push(command.input.Key);
        return {};
      }
      return {};
    },
  };
  setS3Client(mockS3);

  try {
    User.findById = async () => ({
      _id: 'userA',
      avatar: 'avatars/userA/old-photo.png',
      save: async () => {
        throw new Error('Database write failure');
      },
      toObject: () => ({ _id: 'userA', avatar: 'avatars/userA/old-photo.png' }),
    });

    const req = {
      params: { id: 'userA' },
      user: { _id: 'userA' },
      body: { key: 'avatars/userA/new-upload.png' },
    };

    let caughtError = null;
    await confirmAvatarUpload(req, {}, (err) => {
      caughtError = err;
    });

    assert.ok(caughtError, 'Must propagate error on database failure');
    assert.strictEqual(caughtError.message, 'Database write failure');
    assert.ok(
      deletedKeys.includes('avatars/userA/new-upload.png'),
      'Newly uploaded object must be deleted from S3 if DB save fails'
    );
  } finally {
    User.findById = originalFindById;
    setS3Client(null);
  }
});

// 3. Missing S3 configuration is handled correctly
test('Missing S3 configuration produces appropriate configuration error and graceful degradation', async () => {
  const originalEnv = { ...process.env };
  try {
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_S3_BUCKET_NAME;

    setS3Client(null);

    // Assert that checkS3Config throws configuration error
    assert.throws(
      () => checkS3Config(),
      /AWS S3 configuration incomplete\. Missing required environment variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET_NAME/
    );

    // Assert that isS3Configured returns false
    assert.strictEqual(isS3Configured(), false);

    // Assert that resolveAvatarUrl gracefully degrades without crashing
    const key = 'avatars/user123/existing.jpg';
    const resolved = await resolveAvatarUrl(key);
    assert.strictEqual(resolved, key, 'Should return key without throwing when S3 unconfigured');
  } finally {
    process.env = originalEnv;
    setS3Client(null);
  }
});

// 4. Empty, null, non-string and malformed object keys are rejected
test('Empty, null, non-string and malformed object keys are rejected with 400', async () => {
  const testCases = [
    { key: '' },
    { key: '   ' },
    { key: null },
    { key: undefined },
    { key: 12345 },
    { key: {} },
    { key: 'avatars/userA/' }, // missing filename
    { key: 'avatars/userA/malformed' }, // missing extension
    { key: 'avatars/userA/script.js' }, // invalid extension
  ];

  for (const tc of testCases) {
    const req = {
      params: { id: 'userA' },
      user: { _id: 'userA' },
      body: tc,
    };

    let statusCode = null;
    let jsonResponse = null;
    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => {
            jsonResponse = data;
          },
        };
      },
    };

    await confirmAvatarUpload(req, res, () => {});
    assert.strictEqual(
      statusCode,
      400,
      `Payload ${JSON.stringify(tc)} must be rejected with 400 Bad Request`
    );
    assert.strictEqual(jsonResponse.success, false);
  }
});

// 5. Existing avatars remain intact if replacement fails
test('Existing avatars remain intact if replacement fails', async () => {
  const originalFindById = User.findById;
  const deletedKeys = [];
  const existingAvatarKey = 'avatars/userA/current-avatar.jpg';

  const mockS3 = {
    send: async (command) => {
      if (command.constructor.name === 'HeadObjectCommand') {
        return { ContentLength: 1024, ContentType: 'image/jpeg' };
      }
      if (command.constructor.name === 'DeleteObjectCommand') {
        deletedKeys.push(command.input.Key);
        return {};
      }
      return {};
    },
  };
  setS3Client(mockS3);

  try {
    let mockUserRecord = {
      _id: 'userA',
      avatar: existingAvatarKey,
      save: async () => {
        throw new Error('Database transaction abort');
      },
      toObject: () => ({ _id: 'userA', avatar: existingAvatarKey }),
    };

    User.findById = async () => mockUserRecord;

    const req = {
      params: { id: 'userA' },
      user: { _id: 'userA' },
      body: { key: 'avatars/userA/replacement.jpg' },
    };

    await confirmAvatarUpload(req, {}, () => {});

    // Verify existing avatar was NOT deleted from S3
    assert.strictEqual(
      deletedKeys.includes(existingAvatarKey),
      false,
      'Existing avatar key must NOT be deleted if replacement fails'
    );

    // Verify the replacement key WAS cleaned up
    assert.ok(
      deletedKeys.includes('avatars/userA/replacement.jpg'),
      'New upload key must be deleted when replacement fails'
    );
  } finally {
    User.findById = originalFindById;
    setS3Client(null);
  }
});
