// routes/skills.routes.js
const express = require('express');
const router = express.Router();
const { getAllSkills, createSkill, updateSkill, deleteSkill } = require('../controllers/skills.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);

router.get('/',       getAllSkills);   // GET    /api/skills
router.post('/',      createSkill);   // POST   /api/skills
router.put('/:id',    updateSkill);   // PUT    /api/skills/:id
router.delete('/:id', deleteSkill);   // DELETE /api/skills/:id

module.exports = router;
