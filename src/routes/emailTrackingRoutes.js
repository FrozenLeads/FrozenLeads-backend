const express = require('express');

const { userAuth } = require('../middlewares/Auth.js');

const UserLeadActivity = require('../models/UserLeadActivity.js');



// --- CORRECTED AND CLEANED IMPORTS ---

const { listDrafts, sendFromDraft } = require('../controllers/draftSendingController.js');

const allTracking = require('../controllers/allTracking.js');

const { startTracking } = require('../controllers/emailTracking.js');

const { checkEmailStatusController } = require('../jobs/emailStatusChecker.js');



const Trackingrouter = express.Router();

// --- ROUTES ---



// Note: The public '/track/open/:trackingId' route has been removed as per your request.



// Legacy route for manually tracking an already-sent email.

Trackingrouter.post('/track', userAuth, startTracking);



// Get details of a single tracking record.

Trackingrouter.get('/tracking/:id', userAuth, async (req, res) => {

  try {

    const tracking = await UserLeadActivity.findOne({ _id: req.params.id, user: req.user._id });

    if (!tracking) {

      return res.status(404).json({ error: 'Tracking not found' });

    }

    res.json(tracking);

  } catch (err) {

    console.error('Fetch tracking error:', err);

    res.status(500).json({ error: 'Failed to fetch tracking status' });

  }

});



// Get all of the user's tracking records.

Trackingrouter.get('/trackings', userAuth, allTracking);



// Manually trigger the "Smart Status Check" job.

Trackingrouter.post('/sync-status', userAuth, checkEmailStatusController);



// Get a list of the user's Gmail drafts.

Trackingrouter.get('/track/drafts', userAuth, listDrafts);



// Send an email from a draft and begin tracking it.

Trackingrouter.post('/track/send-draft', userAuth, sendFromDraft);



// Manually update the status of a tracked email (e.g., to "not-interested").

Trackingrouter.patch('/track/:trackingId/status', userAuth, async (req, res) => {

    try {

        const { status } = req.body;

        const allowedStatuses = ['not-interested', 'follow-up'];

        if (!allowedStatuses.includes(status)) {

            return res.status(400).json({ error: 'Invalid status value.' });

        }



        const tracking = await UserLeadActivity.findOne({ _id: req.params.trackingId, user: req.user._id });



        if (!tracking) {

            return res.status(404).json({ error: 'Tracking record not found.' });

        }



        tracking.status = status;

        await tracking.save();

        res.json(tracking);

    } catch (error) {

        console.error('Failed to update status:', error);

        res.status(500).json({ error: 'Failed to update status.' });

    }

});





// --- THIS IS THE CRUCIAL EXPORT LINE ---

module.exports = Trackingrouter;