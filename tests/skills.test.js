// tests/skills.test.js
// Automated tests for Skills API Security Hardening
// Uses Node.js built-in test runner (node:test) with mock Express req/res and Mongoose operations.
const test = require('node:test');
const assert = require('node:assert');
const Skill = require('../server/models/Skill');
const {
  getAllSkills,
  createSkill,
  updateSkill,
  deleteSkill,
} = require('../server/controllers/skills.controller');
const {
  isValidObjectId,
  isValidSkillCategory,
  isValidSkillType,
} = require('../server/utils/validators');

// Helper to construct a mock Express response object
const createMockRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
};

// ── 1. Unit Tests for Validator Helpers ────────────────────────────────────────
test('isValidObjectId accepts valid 24-character hex strings and rejects malformed values', () => {
  assert.strictEqual(isValidObjectId('507f1f77bcf86cd799439011'), true);
  assert.strictEqual(isValidObjectId('64f1a2b3c4d5e6f7a8b9c0d1'), true);

  // Invalid lengths, non-hex characters, or non-strings
  assert.strictEqual(isValidObjectId('507f1f77bcf86cd79943901'), false); // 23 chars
  assert.strictEqual(isValidObjectId('507f1f77bcf86cd7994390111'), false); // 25 chars
  assert.strictEqual(isValidObjectId('507f1f77bcf86cd79943901g'), false); // non-hex 'g'
  assert.strictEqual(isValidObjectId(123456789), false);
  assert.strictEqual(isValidObjectId(null), false);
  assert.strictEqual(isValidObjectId({}), false);
});

test('isValidSkillCategory accepts approved categories and rejects unlisted or oversized inputs', () => {
  assert.strictEqual(isValidSkillCategory('Programming'), true);
  assert.strictEqual(isValidSkillCategory('Design'), true);
  assert.strictEqual(isValidSkillCategory('General'), true);

  assert.strictEqual(isValidSkillCategory('Hacking'), false);
  assert.strictEqual(isValidSkillCategory(''), false);
  assert.strictEqual(isValidSkillCategory(123), false);
  assert.strictEqual(isValidSkillCategory(null), false);
});

// ── 2. Controller Tests: Query Parameter Validation (getAllSkills) ─────────────
test('getAllSkills rejects non-primitive string query parameters with HTTP 400', async () => {
  // Test NoSQL query object injection attempt: ?userId[$ne]=null
  const reqObjectInjection = {
    query: {
      userId: { $ne: null },
    },
  };
  const resObject = createMockRes();

  await getAllSkills(reqObjectInjection, resObject, () => {});
  assert.strictEqual(resObject.statusCode, 400, 'Must return 400 for object query parameter');
  assert.strictEqual(resObject.body.success, false);
  assert.match(resObject.body.message, /must be a string/);

  // Test array query parameter attempt: ?type[]=offer&type[]=want
  const reqArray = {
    query: {
      type: ['offer', 'want'],
    },
  };
  const resArray = createMockRes();

  await getAllSkills(reqArray, resArray, () => {});
  assert.strictEqual(resArray.statusCode, 400, 'Must return 400 for array query parameter');
  assert.match(resArray.body.message, /must be a string/);
});

test('getAllSkills rejects invalid userId format with HTTP 400', async () => {
  const req = {
    query: {
      userId: 'not-a-valid-hex-id',
    },
  };
  const res = createMockRes();

  await getAllSkills(req, res, () => {});
  assert.strictEqual(res.statusCode, 400, 'Must return 400 for invalid ObjectId');
  assert.strictEqual(res.body.success, false);
  assert.match(res.body.message, /Invalid userId format/);
});

test('getAllSkills rejects invalid skill type and invalid category with HTTP 400', async () => {
  // Invalid type
  const reqType = {
    query: { type: 'teach' },
  };
  const resType = createMockRes();
  await getAllSkills(reqType, resType, () => {});
  assert.strictEqual(resType.statusCode, 400);
  assert.match(resType.body.message, /Skill type must be either 'offer' or 'want'/);

  // Invalid category
  const reqCat = {
    query: { category: 'InvalidCategoryName' },
  };
  const resCat = createMockRes();
  await getAllSkills(reqCat, resCat, () => {});
  assert.strictEqual(resCat.statusCode, 400);
  assert.match(resCat.body.message, /Invalid category/);

  // Oversized search query (> 100 characters)
  const reqSearch = {
    query: { search: 'a'.repeat(101) },
  };
  const resSearch = createMockRes();
  await getAllSkills(reqSearch, resSearch, () => {});
  assert.strictEqual(resSearch.statusCode, 400);
  assert.match(resSearch.body.message, /Search query cannot exceed 100 characters/);
});

// ── 3. Controller Tests: Pagination Boundaries (getAllSkills) ─────────────────
test('getAllSkills rejects invalid pagination parameters with HTTP 400', async () => {
  // page < 1
  const reqPageZero = { query: { page: '0' } };
  const resPageZero = createMockRes();
  await getAllSkills(reqPageZero, resPageZero, () => {});
  assert.strictEqual(resPageZero.statusCode, 400);
  assert.match(resPageZero.body.message, /Page must be a positive integer/);

  // non-integer page
  const reqPageAlpha = { query: { page: 'abc' } };
  const resPageAlpha = createMockRes();
  await getAllSkills(reqPageAlpha, resPageAlpha, () => {});
  assert.strictEqual(resPageAlpha.statusCode, 400);

  // limit < 1
  const reqLimitZero = { query: { limit: '0' } };
  const resLimitZero = createMockRes();
  await getAllSkills(reqLimitZero, resLimitZero, () => {});
  assert.strictEqual(resLimitZero.statusCode, 400);
  assert.match(resLimitZero.body.message, /Limit must be an integer between 1 and 100/);

  // limit > 100 (maximum bound violation)
  const reqLimitOver = { query: { limit: '101' } };
  const resLimitOver = createMockRes();
  await getAllSkills(reqLimitOver, resLimitOver, () => {});
  assert.strictEqual(resLimitOver.statusCode, 400);
  assert.match(resLimitOver.body.message, /Limit must be an integer between 1 and 100/);
});

test('getAllSkills returns pagination metadata with default boundaries', async () => {
  const originalCountDocuments = Skill.countDocuments;
  const originalFind = Skill.find;

  try {
    Skill.countDocuments = async () => 45;
    Skill.find = () => ({
      sort: () => ({
        skip: () => ({
          limit: () => ({
            populate: async () => [
              {
                _id: '507f1f77bcf86cd799439011',
                name: 'React.js',
                type: 'offer',
                userId: { _id: '507f1f77bcf86cd799439012', name: 'Student A' },
              },
            ],
          }),
        }),
      }),
    });

    const req = { query: {} }; // no explicit page or limit; should default to page 1, limit 20
    const res = createMockRes();

    await getAllSkills(req, res, () => {});
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.page, 1, 'Default page must be 1');
    assert.strictEqual(res.body.limit, 20, 'Default limit must be 20');
    assert.strictEqual(res.body.total, 45);
    assert.strictEqual(res.body.totalPages, 3);
    assert.strictEqual(res.body.count, 1);
    assert.ok(Array.isArray(res.body.skills));
  } finally {
    Skill.countDocuments = originalCountDocuments;
    Skill.find = originalFind;
  }
});

// ── 4. Controller Tests: userId Spoofing Protection (createSkill) ──────────────
test('createSkill enforces authenticated user ID and ignores submitted userId in request body', async () => {
  const originalCreate = Skill.create;
  let capturedCreatePayload = null;

  try {
    Skill.create = async (payload) => {
      capturedCreatePayload = payload;
      return {
        ...payload,
        _id: '507f1f77bcf86cd799439011',
        populate: async () => {},
      };
    };

    const req = {
      user: { _id: '507f1f77bcf86cd7994390aa' }, // Genuine authenticated user
      body: {
        name: 'Node.js Security',
        type: 'offer',
        category: 'Programming',
        description: 'Secure API development',
        userId: '507f1f77bcf86cd7994390bb', // Spoofed target user ID in body
      },
    };
    const res = createMockRes();

    await createSkill(req, res, () => {});

    assert.strictEqual(res.statusCode, 201);
    assert.ok(capturedCreatePayload, 'Skill.create must be called');
    assert.strictEqual(
      capturedCreatePayload.userId,
      '507f1f77bcf86cd7994390aa',
      'Must use authenticated req.user._id'
    );
    assert.notStrictEqual(
      capturedCreatePayload.userId,
      '507f1f77bcf86cd7994390bb',
      'Must ignore attacker-supplied userId'
    );
  } finally {
    Skill.create = originalCreate;
  }
});

// ── 5. Controller Tests: Ownership-Scoped Atomic Operations (updateSkill & deleteSkill)
test('updateSkill rejects invalid skill ID format with HTTP 400', async () => {
  const req = {
    params: { id: 'invalid-id-xyz' },
    user: { _id: '507f1f77bcf86cd7994390aa' },
    body: { name: 'Valid Name' },
  };
  const res = createMockRes();

  await updateSkill(req, res, () => {});
  assert.strictEqual(res.statusCode, 400);
  assert.match(res.body.message, /Invalid skill ID format/);
});

test('updateSkill: User B cannot modify User A skill (atomic owner query returns 403)', async () => {
  const originalFindOneAndUpdate = Skill.findOneAndUpdate;
  const originalExists = Skill.exists;

  try {
    // When queried with both { _id, userId: 'userB' }, findOneAndUpdate matches nothing
    Skill.findOneAndUpdate = () => ({
      populate: async () => null,
    });
    // But the document exists in the database belonging to another user
    Skill.exists = async () => ({ _id: '507f1f77bcf86cd799439011' });

    const req = {
      params: { id: '507f1f77bcf86cd799439011' },
      user: { _id: '507f1f77bcf86cd7994390bb' }, // User B
      body: { name: 'Malicious Overwrite' },
    };
    const res = createMockRes();

    await updateSkill(req, res, () => {});
    assert.strictEqual(res.statusCode, 403, 'Must return 403 Forbidden when modifying another user skill');
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /Not authorized to update this skill/);
  } finally {
    Skill.findOneAndUpdate = originalFindOneAndUpdate;
    Skill.exists = originalExists;
  }
});

test('deleteSkill rejects invalid skill ID format with HTTP 400', async () => {
  const req = {
    params: { id: 'bad-id' },
    user: { _id: '507f1f77bcf86cd7994390aa' },
  };
  const res = createMockRes();

  await deleteSkill(req, res, () => {});
  assert.strictEqual(res.statusCode, 400);
  assert.match(res.body.message, /Invalid skill ID format/);
});

test('deleteSkill: User B cannot delete User A skill (atomic owner query returns 403)', async () => {
  const originalFindOneAndDelete = Skill.findOneAndDelete;
  const originalExists = Skill.exists;

  try {
    // findOneAndDelete with { _id, userId: 'userB' } deletes nothing
    Skill.findOneAndDelete = async () => null;
    // But skill exists in DB
    Skill.exists = async () => ({ _id: '507f1f77bcf86cd799439011' });

    const req = {
      params: { id: '507f1f77bcf86cd799439011' },
      user: { _id: '507f1f77bcf86cd7994390bb' }, // User B
    };
    const res = createMockRes();

    await deleteSkill(req, res, () => {});
    assert.strictEqual(res.statusCode, 403, 'Must return 403 Forbidden when deleting another user skill');
    assert.match(res.body.message, /Not authorized to delete this skill/);
  } finally {
    Skill.findOneAndDelete = originalFindOneAndDelete;
    Skill.exists = originalExists;
  }
});

test('updateSkill and deleteSkill succeed when invoked by the true owner', async () => {
  const originalFindOneAndUpdate = Skill.findOneAndUpdate;
  const originalFindOneAndDelete = Skill.findOneAndDelete;

  try {
    // Owner update succeeds
    Skill.findOneAndUpdate = () => ({
      populate: async () => ({
        _id: '507f1f77bcf86cd799439011',
        name: 'Updated Skill Name',
        userId: { _id: '507f1f77bcf86cd7994390aa', name: 'Owner' },
      }),
    });

    const reqUpdate = {
      params: { id: '507f1f77bcf86cd799439011' },
      user: { _id: '507f1f77bcf86cd7994390aa' }, // Owner
      body: { name: 'Updated Skill Name' },
    };
    const resUpdate = createMockRes();
    await updateSkill(reqUpdate, resUpdate, () => {});
    assert.strictEqual(resUpdate.statusCode, 200);
    assert.strictEqual(resUpdate.body.success, true);
    assert.strictEqual(resUpdate.body.skill.name, 'Updated Skill Name');

    // Owner delete succeeds
    Skill.findOneAndDelete = async () => ({
      _id: '507f1f77bcf86cd799439011',
      userId: '507f1f77bcf86cd7994390aa',
    });

    const reqDelete = {
      params: { id: '507f1f77bcf86cd799439011' },
      user: { _id: '507f1f77bcf86cd7994390aa' }, // Owner
    };
    const resDelete = createMockRes();
    await deleteSkill(reqDelete, resDelete, () => {});
    assert.strictEqual(resDelete.statusCode, 200);
    assert.strictEqual(resDelete.body.success, true);
    assert.match(resDelete.body.message, /Skill deleted successfully/);
  } finally {
    Skill.findOneAndUpdate = originalFindOneAndUpdate;
    Skill.findOneAndDelete = originalFindOneAndDelete;
  }
});

// ── 6. express-validator Middleware Integration Tests ────────────────────────
const { createSkillValidation, updateSkillValidation } = require('../server/routes/skills.routes');

test('createSkillValidation rejects missing or invalid body parameters', async () => {
  const reqInvalid = {
    body: {
      name: '', // empty name
      type: 'invalidType', // invalid type
      category: 'FakeCategory', // invalid category
    },
  };
  const res = createMockRes();

  // Run all validation chains
  await Promise.all(createSkillValidation.map((v) => v.run(reqInvalid)));
  await createSkill(reqInvalid, res, () => {});

  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.success, false);
  assert.ok(Array.isArray(res.body.errors));
  assert.ok(res.body.errors.length >= 2, 'Must catch invalid name, type, and category');
});

test('updateSkillValidation rejects invalid field types or values', async () => {
  const reqInvalid = {
    params: { id: '507f1f77bcf86cd799439011' },
    user: { _id: '507f1f77bcf86cd7994390aa' },
    body: {
      type: 'invalidType',
    },
  };
  const res = createMockRes();

  await Promise.all(updateSkillValidation.map((v) => v.run(reqInvalid)));
  await updateSkill(reqInvalid, res, () => {});

  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.success, false);
  assert.ok(Array.isArray(res.body.errors));
});
