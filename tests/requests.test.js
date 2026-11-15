// tests/requests.test.js
// Automated Mocked Controller Tests for Exchange Request API Security Hardening
// NOTE: These are mocked controller tests using Node.js built-in test runner (node:test).
// They mock Mongoose operations and do NOT start a live HTTP server or connect to a live MongoDB instance.
const test = require('node:test');
const assert = require('node:assert');
const Request = require('../server/models/Request');
const User = require('../server/models/User');
const Skill = require('../server/models/Skill');
const {
  getRequests,
  createRequest,
  updateRequest,
  deleteRequest,
} = require('../server/controllers/requests.controller');
const {
  createRequestValidation,
  updateRequestValidation,
  deleteRequestValidation,
} = require('../server/routes/requests.routes');

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

// Valid test MongoDB ObjectIds
const USER_A_ID = '507f1f77bcf86cd799439011';
const USER_B_ID = '507f1f77bcf86cd799439022';
const USER_C_ID = '507f1f77bcf86cd799439033';
const SKILL_OFFER_A = '507f1f77bcf86cd7994390aa';
const SKILL_OFFER_B = '507f1f77bcf86cd7994390bb';
const SKILL_WANT_A = '507f1f77bcf86cd7994390cc';
const REQUEST_ID = '507f1f77bcf86cd7994390dd';

// ── 1. Request Creation & Sender Identity ─────────────────────────────────────
test('createRequest derives senderId strictly from req.user._id and ignores submitted senderId', async () => {
  const originalUserFindById = User.findById;
  const originalSkillFindById = Skill.findById;
  const originalRequestFindOne = Request.findOne;
  const originalRequestCreate = Request.create;

  let capturedCreatePayload = null;

  try {
    User.findById = async (id) => ({ _id: id, name: 'Recipient' });
    Skill.findById = async (id) => {
      if (id === SKILL_OFFER_A) {
        return { _id: id, userId: USER_A_ID, type: 'offer', name: 'JavaScript' };
      }
      if (id === SKILL_OFFER_B) {
        return { _id: id, userId: USER_B_ID, type: 'offer', name: 'Python' };
      }
      return null;
    };
    Request.findOne = async () => null; // No duplicate
    Request.create = async (payload) => {
      capturedCreatePayload = payload;
      return {
        ...payload,
        _id: REQUEST_ID,
        populate: async () => {},
      };
    };

    const req = {
      user: { _id: USER_A_ID }, // Genuine authenticated sender
      body: {
        receiverId: USER_B_ID,
        offeredSkillId: SKILL_OFFER_A,
        wantedSkillId: SKILL_OFFER_B,
        message: 'Looking to swap skills!',
        senderId: USER_C_ID, // Malicious spoofed senderId attempt
      },
    };
    const res = createMockRes();

    await createRequest(req, res, () => {});

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(capturedCreatePayload, 'Request.create must be invoked');
    assert.strictEqual(
      capturedCreatePayload.senderId,
      USER_A_ID,
      'senderId must match authenticated req.user._id'
    );
    assert.notStrictEqual(
      capturedCreatePayload.senderId,
      USER_C_ID,
      'Submitted senderId in request body must be ignored'
    );
  } finally {
    User.findById = originalUserFindById;
    Skill.findById = originalSkillFindById;
    Request.findOne = originalRequestFindOne;
    Request.create = originalRequestCreate;
  }
});

// ── 2. Self-Request Rejection ─────────────────────────────────────────────────
test('createRequest rejects self-directed requests with HTTP 400', async () => {
  const req = {
    user: { _id: USER_A_ID },
    body: {
      receiverId: USER_A_ID, // Same as sender
      offeredSkillId: SKILL_OFFER_A,
      wantedSkillId: SKILL_OFFER_B,
    },
  };
  const res = createMockRes();

  await createRequest(req, res, () => {});

  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.success, false);
  assert.match(res.body.message, /Cannot send request to yourself/);
});

// ── 3. Skill Ownership & Skill Type Validation ────────────────────────────────
test('createRequest validates skill ownership and enforces type="offer" on both skills', async () => {
  const originalUserFindById = User.findById;
  const originalSkillFindById = Skill.findById;

  try {
    User.findById = async () => ({ _id: USER_B_ID });

    // Case A: Offered skill does not belong to sender
    Skill.findById = async (id) => {
      if (id === SKILL_OFFER_A) {
        return { _id: id, userId: USER_C_ID, type: 'offer' }; // Belongs to User C
      }
      return { _id: id, userId: USER_B_ID, type: 'offer' };
    };

    const reqWrongOwner = {
      user: { _id: USER_A_ID },
      body: { receiverId: USER_B_ID, offeredSkillId: SKILL_OFFER_A, wantedSkillId: SKILL_OFFER_B },
    };
    const resWrongOwner = createMockRes();
    await createRequest(reqWrongOwner, resWrongOwner, () => {});
    assert.strictEqual(resWrongOwner.statusCode, 400);
    assert.match(resWrongOwner.body.message, /Invalid offered skill/);

    // Case B: Offered skill belongs to sender, but has type !== 'offer' (e.g. 'want')
    Skill.findById = async (id) => {
      if (id === SKILL_WANT_A) {
        return { _id: id, userId: USER_A_ID, type: 'want' }; // Type is 'want'
      }
      return { _id: id, userId: USER_B_ID, type: 'offer' };
    };

    const reqWrongTypeSender = {
      user: { _id: USER_A_ID },
      body: { receiverId: USER_B_ID, offeredSkillId: SKILL_WANT_A, wantedSkillId: SKILL_OFFER_B },
    };
    const resWrongTypeSender = createMockRes();
    await createRequest(reqWrongTypeSender, resWrongTypeSender, () => {});
    assert.strictEqual(resWrongTypeSender.statusCode, 400);
    assert.match(resWrongTypeSender.body.message, /Offered skill must have type 'offer'/);

    // Case C: Wanted skill belongs to receiver, but receiver marked it as 'want'
    Skill.findById = async (id) => {
      if (id === SKILL_OFFER_A) {
        return { _id: id, userId: USER_A_ID, type: 'offer' };
      }
      return { _id: id, userId: USER_B_ID, type: 'want' }; // Receiver wants this, does not offer it
    };

    const reqWrongTypeReceiver = {
      user: { _id: USER_A_ID },
      body: { receiverId: USER_B_ID, offeredSkillId: SKILL_OFFER_A, wantedSkillId: SKILL_OFFER_B },
    };
    const resWrongTypeReceiver = createMockRes();
    await createRequest(reqWrongTypeReceiver, resWrongTypeReceiver, () => {});
    assert.strictEqual(resWrongTypeReceiver.statusCode, 400);
    assert.match(resWrongTypeReceiver.body.message, /Wanted skill must have type 'offer'/);
  } finally {
    User.findById = originalUserFindById;
    Skill.findById = originalSkillFindById;
  }
});

// ── 4. Duplicate Request Handling ─────────────────────────────────────────────
test('createRequest rejects duplicate request with HTTP 409', async () => {
  const originalUserFindById = User.findById;
  const originalSkillFindById = Skill.findById;
  const originalRequestFindOne = Request.findOne;

  try {
    User.findById = async () => ({ _id: USER_B_ID });
    Skill.findById = async (id) => {
      if (id === SKILL_OFFER_A) return { _id: id, userId: USER_A_ID, type: 'offer' };
      return { _id: id, userId: USER_B_ID, type: 'offer' };
    };
    Request.findOne = async () => ({ _id: REQUEST_ID, status: 'pending' }); // Duplicate exists

    const req = {
      user: { _id: USER_A_ID },
      body: { receiverId: USER_B_ID, offeredSkillId: SKILL_OFFER_A, wantedSkillId: SKILL_OFFER_B },
    };
    const res = createMockRes();

    await createRequest(req, res, () => {});
    assert.strictEqual(res.statusCode, 409);
    assert.match(res.body.message, /Request already sent for this skill pair/);
  } finally {
    User.findById = originalUserFindById;
    Skill.findById = originalSkillFindById;
    Request.findOne = originalRequestFindOne;
  }
});

// ── 5. Query Validation & Operator Injection (getRequests) ────────────────────
test('getRequests rejects non-primitive string query parameters with HTTP 400', async () => {
  // Test NoSQL operator injection attempt: ?status[$ne]=declined
  const reqObj = {
    user: { _id: USER_A_ID },
    query: { status: { $ne: 'declined' } },
  };
  const resObj = createMockRes();
  await getRequests(reqObj, resObj, () => {});
  assert.strictEqual(resObj.statusCode, 400);
  assert.match(resObj.body.message, /must be a string/);

  // Test array query parameter attempt: ?direction[]=sent
  const reqArr = {
    user: { _id: USER_A_ID },
    query: { direction: ['sent', 'received'] },
  };
  const resArr = createMockRes();
  await getRequests(reqArr, resArr, () => {});
  assert.strictEqual(resArr.statusCode, 400);
  assert.match(resArr.body.message, /must be a string/);

  // Test invalid status enum
  const reqInvalidStatus = {
    user: { _id: USER_A_ID },
    query: { status: 'invalid_status' },
  };
  const resInvalidStatus = createMockRes();
  await getRequests(reqInvalidStatus, resInvalidStatus, () => {});
  assert.strictEqual(resInvalidStatus.statusCode, 400);
  assert.match(resInvalidStatus.body.message, /Status must be pending, accepted, or declined/);

  // Test invalid direction enum
  const reqInvalidDir = {
    user: { _id: USER_A_ID },
    query: { direction: 'sideways' },
  };
  const resInvalidDir = createMockRes();
  await getRequests(reqInvalidDir, resInvalidDir, () => {});
  assert.strictEqual(resInvalidDir.statusCode, 400);
  assert.match(resInvalidDir.body.message, /Direction must be either 'sent' or 'received'/);
});

// ── 6. Sent / Received Filtering & Pagination Defaults ────────────────────────
test('getRequests applies direction filter and returns pagination metadata', async () => {
  const originalCountDocuments = Request.countDocuments;
  const originalFind = Request.find;
  let capturedFilter = null;

  try {
    Request.countDocuments = async (filter) => {
      capturedFilter = filter;
      return 12;
    };
    Request.find = () => ({
      populate: () => ({
        populate: () => ({
          populate: () => ({
            populate: () => ({
              sort: () => ({
                skip: () => ({
                  limit: async () => [{ _id: REQUEST_ID, status: 'pending' }],
                }),
              }),
            }),
          }),
        }),
      }),
    });

    const req = {
      user: { _id: USER_A_ID },
      query: { direction: 'sent', status: 'pending' },
    };
    const res = createMockRes();

    await getRequests(req, res, () => {});

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.page, 1, 'Default page must be 1');
    assert.strictEqual(res.body.limit, 20, 'Default limit must be 20');
    assert.strictEqual(res.body.total, 12);
    assert.strictEqual(res.body.totalPages, 1);
    assert.strictEqual(capturedFilter.senderId, USER_A_ID);
    assert.strictEqual(capturedFilter.status, 'pending');
  } finally {
    Request.countDocuments = originalCountDocuments;
    Request.find = originalFind;
  }
});

test('getRequests rejects out-of-boundary pagination parameters with HTTP 400', async () => {
  const reqPageZero = { user: { _id: USER_A_ID }, query: { page: '0' } };
  const resPageZero = createMockRes();
  await getRequests(reqPageZero, resPageZero, () => {});
  assert.strictEqual(resPageZero.statusCode, 400);

  const reqLimitOver = { user: { _id: USER_A_ID }, query: { limit: '101' } };
  const resLimitOver = createMockRes();
  await getRequests(reqLimitOver, resLimitOver, () => {});
  assert.strictEqual(resLimitOver.statusCode, 400);
  assert.match(resLimitOver.body.message, /Limit must be an integer between 1 and 100/);
});

// ── 7. Receiver-Only Atomic Accept/Decline (updateRequest) ─────────────────────
test('updateRequest: Only receiver can update and only pending requests can be transitioned', async () => {
  const originalFindOneAndUpdate = Request.findOneAndUpdate;
  const originalFindById = Request.findById;

  try {
    // Case A: Sender attempts to accept/decline their own request
    Request.findOneAndUpdate = () => ({ populate: async () => null });
    Request.findById = async () => ({
      _id: REQUEST_ID,
      senderId: USER_A_ID,
      receiverId: USER_B_ID,
      status: 'pending',
    });

    const reqSender = {
      params: { id: REQUEST_ID },
      user: { _id: USER_A_ID }, // Sender, NOT receiver
      body: { status: 'accepted' },
    };
    const resSender = createMockRes();
    await updateRequest(reqSender, resSender, () => {});
    assert.strictEqual(resSender.statusCode, 403);
    assert.match(resSender.body.message, /Only the receiver can update this request/);

    // Case B: Receiver accepts successfully
    Request.findOneAndUpdate = () => ({
      populate: async () => ({
        _id: REQUEST_ID,
        senderId: USER_A_ID,
        receiverId: USER_B_ID,
        status: 'accepted',
      }),
    });

    const reqReceiver = {
      params: { id: REQUEST_ID },
      user: { _id: USER_B_ID }, // Receiver
      body: { status: 'accepted' },
    };
    const resReceiver = createMockRes();
    await updateRequest(reqReceiver, resReceiver, () => {});
    assert.strictEqual(resReceiver.statusCode, 200);
    assert.strictEqual(resReceiver.body.success, true);
    assert.strictEqual(resReceiver.body.request.status, 'accepted');

    // Case C: Concurrency / double-action: attempting to update already accepted request
    Request.findOneAndUpdate = () => ({ populate: async () => null });
    Request.findById = async () => ({
      _id: REQUEST_ID,
      receiverId: USER_B_ID,
      status: 'accepted', // Already responded to
    });

    const reqAlreadyResponded = {
      params: { id: REQUEST_ID },
      user: { _id: USER_B_ID },
      body: { status: 'declined' },
    };
    const resAlreadyResponded = createMockRes();
    await updateRequest(reqAlreadyResponded, resAlreadyResponded, () => {});
    assert.strictEqual(resAlreadyResponded.statusCode, 400);
    assert.match(resAlreadyResponded.body.message, /Request has already been responded to/);
  } finally {
    Request.findOneAndUpdate = originalFindOneAndUpdate;
    Request.findById = originalFindById;
  }
});

// ── 8. Safe Atomic Cancellation (deleteRequest) ───────────────────────────────
test('deleteRequest: Sender can cancel pending requests, non-senders are blocked, and accepted requests cannot be cancelled', async () => {
  const originalFindOneAndDelete = Request.findOneAndDelete;
  const originalFindById = Request.findById;

  try {
    // Case A: Sender cancels pending request successfully
    Request.findOneAndDelete = async () => ({
      _id: REQUEST_ID,
      senderId: USER_A_ID,
      status: 'pending',
    });

    const reqSuccess = {
      params: { id: REQUEST_ID },
      user: { _id: USER_A_ID },
    };
    const resSuccess = createMockRes();
    await deleteRequest(reqSuccess, resSuccess, () => {});
    assert.strictEqual(resSuccess.statusCode, 200);
    assert.strictEqual(resSuccess.body.success, true);
    assert.match(resSuccess.body.message, /Request deleted successfully/);

    // Case B: Non-sender attempts delete &rarr; 403
    Request.findOneAndDelete = async () => null;
    Request.findById = async () => ({
      _id: REQUEST_ID,
      senderId: USER_A_ID,
      receiverId: USER_B_ID,
      status: 'pending',
    });

    const reqUnauthorized = {
      params: { id: REQUEST_ID },
      user: { _id: USER_B_ID }, // Receiver or third-party
    };
    const resUnauthorized = createMockRes();
    await deleteRequest(reqUnauthorized, resUnauthorized, () => {});
    assert.strictEqual(resUnauthorized.statusCode, 403);
    assert.match(resUnauthorized.body.message, /Only the sender can delete this request/);

    // Case C: Sender attempts to cancel an already ACCEPTED request &rarr; 400
    Request.findOneAndDelete = async () => null;
    Request.findById = async () => ({
      _id: REQUEST_ID,
      senderId: USER_A_ID,
      status: 'accepted',
    });

    const reqAccepted = {
      params: { id: REQUEST_ID },
      user: { _id: USER_A_ID },
    };
    const resAccepted = createMockRes();
    await deleteRequest(reqAccepted, resAccepted, () => {});
    assert.strictEqual(resAccepted.statusCode, 400);
    assert.match(resAccepted.body.message, /Cannot cancel a request that has already been accepted/);

    // Case D: Sender attempts to cancel an already DECLINED request &rarr; 400
    Request.findById = async () => ({
      _id: REQUEST_ID,
      senderId: USER_A_ID,
      status: 'declined',
    });

    const reqDeclined = {
      params: { id: REQUEST_ID },
      user: { _id: USER_A_ID },
    };
    const resDeclined = createMockRes();
    await deleteRequest(reqDeclined, resDeclined, () => {});
    assert.strictEqual(resDeclined.statusCode, 400);
    assert.match(resDeclined.body.message, /Cannot cancel a request that has already been declined/);
  } finally {
    Request.findOneAndDelete = originalFindOneAndDelete;
    Request.findById = originalFindById;
  }
});

// ── 9. Concurrent Accept vs Cancel Simulation ─────────────────────────────────
test('concurrent accept vs cancel: atomic execution ensures the losing operation fails gracefully', async () => {
  const originalFindOneAndUpdate = Request.findOneAndUpdate;
  const originalFindOneAndDelete = Request.findOneAndDelete;
  const originalFindById = Request.findById;

  try {
    // Scenario 1: Accept won the race, Cancel arrived a millisecond later
    // findOneAndDelete matched nothing because status is already 'accepted'
    Request.findOneAndDelete = async () => null;
    Request.findById = async () => ({
      _id: REQUEST_ID,
      senderId: USER_A_ID,
      status: 'accepted',
    });

    const reqCancelLate = {
      params: { id: REQUEST_ID },
      user: { _id: USER_A_ID },
    };
    const resCancelLate = createMockRes();
    await deleteRequest(reqCancelLate, resCancelLate, () => {});

    assert.strictEqual(resCancelLate.statusCode, 400);
    assert.match(resCancelLate.body.message, /Cannot cancel a request that has already been accepted/);

    // Scenario 2: Cancel won the race (deleted), Accept arrived a millisecond later
    // findOneAndUpdate matched nothing because document was deleted
    Request.findOneAndUpdate = () => ({ populate: async () => null });
    Request.findById = async () => null; // Document is gone

    const reqAcceptLate = {
      params: { id: REQUEST_ID },
      user: { _id: USER_B_ID },
      body: { status: 'accepted' },
    };
    const resAcceptLate = createMockRes();
    await updateRequest(reqAcceptLate, resAcceptLate, () => {});

    assert.strictEqual(resAcceptLate.statusCode, 404);
    assert.match(resAcceptLate.body.message, /Request not found/);
  } finally {
    Request.findOneAndUpdate = originalFindOneAndUpdate;
    Request.findOneAndDelete = originalFindOneAndDelete;
    Request.findById = originalFindById;
  }
});

// ── 10. express-validator Middleware Integration Tests ────────────────────────
test('createRequestValidation rejects malformed ObjectIds and invalid bodies', async () => {
  const reqInvalid = {
    body: {
      receiverId: 'not-a-valid-hex-id',
      offeredSkillId: '123',
      wantedSkillId: null,
      message: 'a'.repeat(301), // exceeds 300 chars
    },
  };
  const res = createMockRes();

  await Promise.all(createRequestValidation.map((v) => v.run(reqInvalid)));
  await createRequest(reqInvalid, res, () => {});

  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.success, false);
  assert.ok(Array.isArray(res.body.errors));
  assert.ok(res.body.errors.length >= 3, 'Must report errors for invalid ObjectIds and message');
});

test('updateRequestValidation rejects invalid request ID format and invalid status', async () => {
  const reqInvalid = {
    params: { id: 'bad-id' },
    body: { status: 'cancelled' }, // not in ['accepted', 'declined']
  };
  const res = createMockRes();

  await Promise.all(updateRequestValidation.map((v) => v.run(reqInvalid)));
  await updateRequest(reqInvalid, res, () => {});

  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.success, false);
  assert.ok(Array.isArray(res.body.errors));
});

test('deleteRequestValidation rejects invalid request ID format', async () => {
  const reqInvalid = {
    params: { id: 'invalid-hex-id' },
    user: { _id: USER_A_ID },
  };
  const res = createMockRes();

  await Promise.all(deleteRequestValidation.map((v) => v.run(reqInvalid)));
  await deleteRequest(reqInvalid, res, () => {});

  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.success, false);
  assert.match(res.body.message, /Invalid request ID format/);
});
