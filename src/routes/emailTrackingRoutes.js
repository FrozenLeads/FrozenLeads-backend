const express = require('express');
const router = express.Router();
const { startTracking, getTrackingStatus } = require('../controllers/emailTracking');
const authenticateUser = require('../middleware/auth');

router.post('/track', authenticateUser, startTracking);
router.get('/tracking/:id', authenticateUser, getTrackingStatus);

module.exports = router;