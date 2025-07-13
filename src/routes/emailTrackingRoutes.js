const express = require('express');
const Trackingrouter = express.Router();
const { startTracking} = require('../controllers/emailTracking');
const {userAuth} = require('../middlewares/Auth')
const  UserLeadActivity = require('../models/UserLeadActivity');
const allTracking = require('../controllers/allTracking');
const  checkEmailStatus = require('../jobs/emailStatusChecker');

Trackingrouter.post('/track', userAuth, startTracking);

Trackingrouter.get('/tracking/:id', userAuth,async (req, res) => {
  try {
    const tracking = await UserLeadActivity.findById(req.params.id);
    if (!tracking) {
      return res.status(404).json({ error: 'Tracking not found' });
    }
    res.json(tracking);
  } catch (err) {
    console.error('Fetch tracking error:', err);
    res.status(500).json({ error: 'Failed to fetch tracking status' });
  }
});

Trackingrouter.get('/trackings',userAuth,allTracking)

Trackingrouter.post('/sync-status', userAuth, async (req, res) => {
  try {
    await checkEmailStatus();
    res.json({ message: 'Status sync complete' });
  } catch (err) {
    console.error('Sync error:', err.message);
    res.status(500).json({ error: 'Failed to sync statuses' });
  }
});

module.exports = Trackingrouter;