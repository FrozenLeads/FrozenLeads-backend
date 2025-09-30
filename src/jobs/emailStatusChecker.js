const UserLeadActivity = require('../models/UserLeadActivity');

const User = require('../models/user');

const { getGmailClient } = require('../utils/gmailClient');



const GHOSTING_THRESHOLD_HOURS = 48;



const checkEmailStatusesLogic = async () => {

    console.log('Running Smart Status Check job (State Machine Strategy)...');

    try {

        // Find all emails that are not manually closed.

        const trackings = await UserLeadActivity.find({

            status: { $nin: ['not-interested'] }

        }).populate('user');



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

               

                // --- THE FINAL, DEFINITIVE FIX STARTS HERE ---

                // This is a more robust way to check the sender's identity.

                const fromMe = fromHeader.toLowerCase().includes(user.emailId.toLowerCase());



                if (fromMe) {

                    // SENDER IS YOU (THE USER):

                    if (oldStatus === 'responded') {

                        // If you are replying to a recruiter, the conversation is active.

                        tracking.status = 'Engaged';

                        await tracking.save();

                        console.log(`✅ [Status Check] User reply to recruiter detected for ${_id}. Status -> 'Engaged'.`);

                    } else if (['sent', 'ghosted'].includes(oldStatus)) {

                        // If you are sending a nudge to an unanswered email, it's a 'follow-up'.

                        tracking.status = 'follow-up';

                        tracking.followUpSentAt = new Date(dateHeader);

                        await tracking.save();

                        console.log(`✅ [Status Check] User nudge (manual follow-up) detected for ${_id}. Status -> 'follow-up'.`);

                    }

                } else {

                    // SENDER IS THE RECRUITER:

                    // If the last message is from the recruiter, the ball is in your court.

                    // The status ALWAYS becomes 'responded'.

                    if (oldStatus !== 'responded') {

                        tracking.status = 'responded';

                        tracking.responseReceivedAt = new Date(dateHeader);

                        await tracking.save();

                        console.log(`✅ [Status Check] Recruiter reply detected for ${_id}. Status -> 'responded'.`);

                    }

                }

                // --- THE FINAL, DEFINITIVE FIX ENDS HERE ---



            } else {

                // Ghosting logic remains the same

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