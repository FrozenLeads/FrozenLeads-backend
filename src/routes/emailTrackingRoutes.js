const express = require('express');
const Trackingrouter = express.Router();
const { startTracking} = require('../controllers/emailTracking');
const {userAuth} = require('../middlewares/Auth')
const  UserLeadActivity = require('../models/UserLeadActivity');

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


module.exports = Trackingrouter;