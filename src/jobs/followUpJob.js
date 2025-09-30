const UserLeadActivity = require('../models/UserLeadActivity');

const { getGmailClient } = require('../utils/gmailClient');



const sendFollowUpEmails = async () => {

    console.log('\n--- Running Automatic Nudge Job (Final Strategy) ---');

    try {

        const emailsToSendNudge = await UserLeadActivity.find({

            followUpScheduled: true,

            responseReceivedAt: null,

            followUpSentAt: null,

        }).populate('user');



        if (emailsToSendNudge.length === 0) {

            console.log('[Job Log] No emails are due for a nudge.');

            return;

        }



        for (const tracking of emailsToSendNudge) {

            if (!['sent', 'opened'].includes(tracking.status)) {

                console.log(`[Job Log] Skipping email to ${tracking.to}, status is '${tracking.status}'.`);

                continue;

            }



            // Using the user-defined delay, defaulting to 3 days.

            const delayInMs = (tracking.followUpDelayDays || 3) * 24 * 60 * 60 * 1000;

            const baseTime = tracking.sentAt;

            const cutoff = Date.now() - delayInMs;



            if (baseTime && new Date(baseTime).getTime() < cutoff) {

                console.log(`[Job Log] Time elapsed for ${tracking.to}. Preparing to send nudge.`);

               

                if (!tracking.user || !tracking.user.googleTokens || !tracking.threadId) {

                    console.log(`[Job Log] CRITICAL-SKIP: Prerequisite missing. User: ${!!tracking.user?.googleTokens}, ThreadId: ${!!tracking.threadId}`);

                    continue;

                }



                const gmail = await getGmailClient(tracking.user._id);

                const user = tracking.user;

               

                const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');

                const followUpBody = `<p>Hi,</p><p>Just wanted to gently follow up on my previous email regarding my application. I'm very interested in the opportunity and would love to hear back when you have a moment.</p><p>Best regards,</p><p>${user.firstName}</p>`;

               

                const simpleRawMessage = [

                    `Content-Type: text/html; charset="UTF-8"`,

                    `to: ${tracking.to}`,

                    `from: "${fullName}" <${user.emailId}>`,

                    `subject: Re: ${tracking.subject}`,

                    ``,

                    followUpBody

                ].join('\r\n');



                const base64EncodedMessage = Buffer.from(simpleRawMessage).toString('base64url');

               

                console.log(`[Job Log] Attempting to create reply draft in thread: ${tracking.threadId}`);

               

                const createDraftResponse = await gmail.users.drafts.create({

                    userId: 'me',

                    requestBody: {

                        message: {

                            raw: base64EncodedMessage,

                            threadId: tracking.threadId

                        }

                    }

                });

               

                const draftId = createDraftResponse.data.id;

                if (!draftId) {

                     console.error(`[Job Log] ERROR: Failed to create draft for ${tracking.to}`);

                     continue;

                }

                console.log(`[Job Log] Successfully created reply draft with ID: ${draftId}`);

               

                await gmail.users.drafts.send({

                    userId: 'me',

                    requestBody: { id: draftId }

                });

               

                tracking.followUpSentAt = new Date();

                tracking.status = 'follow-up';

                await tracking.save();

                console.log(`✅ Nudge sent successfully to ${tracking.to}`);

            }

        }

    } catch (error) {

        console.error('Error in automatic nudge job:', error.response ? error.response.data : error.message);

    }

};



// Set to run every hour for production. For testing, you can change this to a shorter interval.

setInterval(sendFollowUpEmails, 60 * 60 * 1000);

sendFollowUpEmails(); // Also run once on server startup.



module.exports = { sendFollowUpEmails };