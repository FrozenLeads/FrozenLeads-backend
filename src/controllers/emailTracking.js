const UserLeadActivity = require('../models/UserLeadActivity');
const Lead = require('../models/leads');
const { getGmailClient, getMessageDetail } = require('../utils/gmailClient');

exports.startTracking = async (req, res) => {
    const { to } = req.body;
    const userId = req.user._id;

    try {
        const gmail = await getGmailClient(userId);

        // <-- 1. CALCULATE THE TIMESTAMP FOR 30 DAYS AGO
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        const timestamp = Math.floor(oneDayAgo.getTime() / 1000);

        // <-- 2. CREATE THE NEW, TIME-LIMITED QUERY
        const query = `to:${to} after:${timestamp}`;

        const response = await gmail.users.messages.list({
            userId: 'me',
            q: query,
            labelIds: ['SENT'],
            maxResults: 1
        });

        const messages = response.data.messages || [];

        // <-- 3. PROVIDE A SMART ERROR MESSAGE IF NO RECENT EMAIL IS FOUND
        if (messages.length === 0) {
            return res.status(404).json({
                error: 'No email sent to this address in the last 30 days was found.'
            });
        }

        const messageId = messages[0].id;
        const {
            subject,
            messageIdHeader,
            threadId,
            body
        } = await getMessageDetail(gmail, messageId);

        const existing = await UserLeadActivity.findOne({ user: userId, to, messageId });
        if (existing) {
            return res.status(200).json({
                message: 'Already tracking',
                trackingId: existing._id
            });
        }

        const tracking = new UserLeadActivity({
            user: userId,
            to,
            subject,
            body,
            messageId,
            messageIdHeader,
            threadId,
            status: 'sent',
            sentAt: new Date() // Note: This will be the date of the old email
        });

        await tracking.save();

        // (The automatic lead creation logic remains the same)
        const existingLead = await Lead.findOne({
            LeadEmailId: tracking.to.toLowerCase(),
            user: req.user._id
        });

        if (!existingLead) {
            const newLead = new Lead({
                leadName: tracking.to,
                LeadEmailId: tracking.to,
                user: req.user._id,
                origin: 'tracked',
                isPublic: true
            });
            await newLead.save();
            console.log(`✅ Automatically created a new lead for ${tracking.to}`);
        }

        res.json({
            message: 'Tracking started',
            trackingId: tracking._id
        });
    } catch (err) {
        console.error('Tracking error:', err);
        res.status(500).json({ error: 'Failed to start tracking' });
    }
};