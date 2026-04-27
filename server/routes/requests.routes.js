// routes/requests.routes.js
const express = require('express');
const router = express.Router();
const { getRequests, createRequest, updateRequest, deleteRequest } = require('../controllers/requests.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);

router.get('/',       getRequests);     // GET    /api/requests
router.post('/',      createRequest);   // POST   /api/requests
router.put('/:id',    updateRequest);   // PUT    /api/requests/:id
router.delete('/:id', deleteRequest);   // DELETE /api/requests/:id

module.exports = router;
