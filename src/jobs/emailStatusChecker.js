const cron = require('node-cron');
const UserLeadActivity = require('../models/UserLeadActivity');
const User = require('../models/user');
const { google } = require('googleapis');

async function checkEmailStatus() {
  console.log('Running scheduled email status check...');
  
  try {
    const activeTrackings = await UserLeadActivity.find({
      status: { $nin: ['replied', 'ghosted', 'bounced'] }
    }).populate('user');

    for (const tracking of activeTrackings) {
      try {
        const user = tracking.user;
        if (!user || !user.googleTokens) continue;

        const oAuth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.GOOGLE_REDIRECT_URI
        );

        oAuth2Client.setCredentials(user.googleTokens);
        const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

        const thread = await gmail.users.threads.get({
          userId: 'me',
          id: tracking.messageId
        });

        const messages = thread.data.messages || [];
        const hasReply = messages.some(msg => {
          return msg.labelIds &&
                 !msg.labelIds.includes('SENT') &&
                 new Date(parseInt(msg.internalDate)) > tracking.sentAt;
        });

        if (hasReply) {
          tracking.status = 'replied';
          tracking.respondedAt = new Date();
          await tracking.save();
          continue;
        }

        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        if (tracking.sentAt < threeDaysAgo) {
          tracking.status = 'ghosted';
          tracking.ghosted = true;
          await tracking.save();
        }
      } catch (err) {
        console.error(`Error checking tracking ${tracking._id}:`, err);
      }
    }
  } catch (err) {
    console.error('Job error:', err);
  }
}

cron.schedule('*/10 * * * *', checkEmailStatus);
