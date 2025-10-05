const express = require('express');
const { userAuth } = require('../middlewares/Auth.js');
const UserLeadActivity = require('../models/UserLeadActivity.js');
const { listDrafts, sendFromDraft } = require('../controllers/draftSendingController.js');
const allTracking = require('../controllers/allTracking.js');
const { startTracking } = require('../controllers/emailTracking.js');
const { checkEmailStatusController } = require('../jobs/emailStatusChecker.js');
const Trackingrouter = express.Router();
Trackingrouter.post('/track', userAuth, startTracking);
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

Trackingrouter.get('/trackings', userAuth, allTracking);
Trackingrouter.post('/sync-status', userAuth, checkEmailStatusController);
Trackingrouter.get('/track/drafts', userAuth, listDrafts);
Trackingrouter.post('/track/send-draft', userAuth, sendFromDraft);

Trackingrouter.patch('/tracking/:id/status', userAuth, async (req, res) => {
    try {
        const { status } = req.body;
        // You can add more valid statuses here if needed in the future
        const allowedStatuses = ['not-interested', 'follow-up']; 

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status value.' });
        }

        const tracking = await UserLeadActivity.findOne({ _id: req.params.id, user: req.user._id });

        if (!tracking) {
            return res.status(404).json({ error: 'Tracking record not found.' });
        }

        tracking.status = status;
        await tracking.save();

        res.json(tracking); // Send back the updated record
    } catch (error) {
        console.error('Failed to update status:', error);
        res.status(500).json({ error: 'Failed to update status.' });
    }
});


Trackingrouter.patch('/tracking/:id/name', userAuth, async (req, res) => {
    try {
        const { name } = req.body;
        const tracking = await UserLeadActivity.findOne({ _id: req.params.id, user: req.user._id });

        if (!tracking) {
            return res.status(404).json({ error: 'Tracking record not found.' });
        }

        tracking.name = name;
        await tracking.save();

        res.json(tracking);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update tracking name.' });
    }
});

Trackingrouter.delete('/tracking/:id', userAuth, async (req, res) => {
    try {
        const deletedTracking = await UserLeadActivity.findOneAndDelete({ 
            _id: req.params.id, 
            user: req.user._id 
        });

        if (!deletedTracking) {
            return res.status(404).json({ error: 'Tracking record not found or you do not have permission to delete it.' });
        }

        res.json({ message: 'Tracking record deleted successfully.' });
    } catch (error) {
        console.error("Error deleting tracking record:", error);
        res.status(500).json({ error: 'Failed to delete tracking record.' });
    }
});
module.exports = Trackingrouter;