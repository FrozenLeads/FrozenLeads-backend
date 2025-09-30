const UserLeadActivity = require('../models/UserLeadActivity');
const User = require('../models/user');
const { getGmailClient } = require('../utils/gmailClient');

const GHOSTING_THRESHOLD_HOURS = 48;

const checkEmailStatusesLogic = async () => {
    console.log('Running Smart Status Check job (State Machine Strategy)...');
    try {
        // 1. QUERY MODIFIED: Find all emails, including 'not-interested' ones, to check for replies.
        const trackings = await UserLeadActivity.find({}).populate('user');

        for (const tracking of trackings) {
            const { user, threadId, _id, status: oldStatus } = tracking;
            if (!user || !user.googleTokens || !threadId) continue;

            const gmail = await getGmailClient(user._id);
            const thread = await gmail.users.threads.get({
                userId: 'me',
                id: threadId,
                format: 'metadata',
                metadataHeaders: ['From', 'Date']
            });

            const newMessages = (thread.data.messages || []).slice(1);

            if (newMessages.length > 0) {
                const lastMessage = newMessages[newMessages.length - 1];
                const headers = lastMessage.payload?.headers || [];
                const fromHeader = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
                const dateHeader = headers.find(h => h.name.toLowerCase() === 'date')?.value;

                const fromMe = fromHeader.toLowerCase().includes(user.emailId.toLowerCase());

                if (fromMe) {
                    // SENDER IS YOU (THE USER):
                    // 2. LOGIC UPDATED: If you reply to a 'revived' thread, it becomes 'Engaged'.
                    if (['responded', 'revived'].includes(oldStatus)) {
                        tracking.status = 'Engaged';
                        await tracking.save();
                        console.log(`✅ [Status Check] User reply detected for ${_id}. Status -> 'Engaged'.`);
                    } else if (['sent', 'ghosted'].includes(oldStatus)) {
                        // This logic remains unchanged.
                        tracking.status = 'follow-up';
                        tracking.followUpSentAt = new Date(dateHeader);
                        await tracking.save();
                        console.log(`✅ [Status Check] User nudge (manual follow-up) detected for ${_id}. Status -> 'follow-up'.`);
                    }
                } else {
                    // SENDER IS THE RECRUITER:
                    let statusChanged = false;

                    // 3. NEW LOGIC: If a recruiter replies to a 'not-interested' thread, it's 'revived'.
                    if (oldStatus === 'not-interested') {
                        tracking.status = 'revived';
                        tracking.responseReceivedAt = new Date(dateHeader);
                        await tracking.save();
                        console.log(`✅ [Status Check] Recruiter replied to a 'not-interested' thread for ${_id}. Status -> 'revived'.`);
                        statusChanged = true;
                    } else if (oldStatus !== 'responded') {
                        // This logic is mostly the same but now in an else-if.
                        tracking.status = 'responded';
                        tracking.responseReceivedAt = new Date(dateHeader);
                        await tracking.save();
                        console.log(`✅ [Status Check] Recruiter reply detected for ${_id}. Status -> 'responded'.`);
                        statusChanged = true;
                    }
                }
            } else {
                // GHOSTING LOGIC (Unchanged):
                if (oldStatus !== 'ghosted') {
                    const baseTime = tracking.sentAt;
                    if (baseTime) {
                        const ghostCutoff = Date.now() - (GHOSTING_THRESHOLD_HOURS * 60 * 60 * 1000);
                        if (new Date(baseTime).getTime() < ghostCutoff) {
                            tracking.status = 'ghosted';
                            await tracking.save();
                            console.log(`👻 [Status Check] Status for ${_id} updated to 'ghosted'.`);
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.error('❌ Error in smart status check job:', err.message);
    }
};

exports.checkEmailStatusController = async (req, res) => {
    try {
        await checkEmailStatusesLogic();
        res.json({ message: 'Manual status sync has been triggered.' });
    } catch (err) {
        console.error('❌ Manual sync error:', err.message);
        res.status(500).json({ error: 'Failed to manually sync email statuses.' });
    }
};

setInterval(checkEmailStatusesLogic, 15 * 60 * 1000);
checkEmailStatusesLogic();