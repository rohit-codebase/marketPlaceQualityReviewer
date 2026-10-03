const express = require('express');
const router = express.Router();
const { getAllSections } = require('../policies/policyStore');

// Returns the full policy knowledge base so the frontend can display policy details.
router.get('/', (req, res) => {
  res.json({ success: true, data: getAllSections() });
});

module.exports = router;
