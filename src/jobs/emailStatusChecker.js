const cron = require('node-cron');
const UserLeadActivity = require('../models/UserLeadActivity');
const User = require('../models/user');
const { google } = require('googleapis');

async function checkEmailStatus() {
  console.log('Running scheduled email status check...');

  try {
    const activeTrackings = await UserLeadActivity.find({
      status: { $nin: ['responded', 'ghosted', 'bounced'] }
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
          id: tracking.threadId
        });

        const messages = thread.data.messages || [];
        console.log('Checking thread:', tracking.threadId, 'for recipient:', tracking.to);

        const hasReply = messages.some(msg => {
          const headers = msg.payload?.headers || [];
          const fromHeader = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
          const fromEmail = fromHeader.match(/<(.+?)>/)?.[1] || fromHeader;
          const sentTime = Number(msg.internalDate);

          console.log(`Message from: ${fromEmail}, sent at: ${new Date(sentTime).toISOString()}`);
          console.log(`→ parsed fromEmailLower: ${fromEmail.toLowerCase()}`);
          console.log(`→ parsed sentTimeNum: ${sentTime}, tracking.sentAt: ${tracking.sentAt.getTime()}`);

          return (
            fromEmail.toLowerCase() === tracking.to.toLowerCase() &&
            sentTime > tracking.sentAt.getTime()
          );
        });

        if (hasReply) {
          console.log(`Reply detected from ${tracking.to}, updating status...`);
          tracking.status = 'responded';
          tracking.respondedAt = new Date();
          await tracking.save();
          continue;
        }

        // --- ✅ Fallback check if reply not found in thread
        const fallbackList = await gmail.users.messages.list({
          userId: 'me',
          q: `from:${tracking.to}`,
          labelIds: ['INBOX'],
          maxResults: 5
        });

        const fallbackMessages = fallbackList.data.messages || [];
        for (const msg of fallbackMessages) {
          const fullMsg = await gmail.users.messages.get({ userId: 'me', id: msg.id });
          const sentTime = Number(fullMsg.data.internalDate);
          if (sentTime > tracking.sentAt.getTime()) {
            console.log(`Fallback reply detected from ${tracking.to}`);
            tracking.status = 'responded';
            tracking.respondedAt = new Date();
            await tracking.save();
            break;
          }
        }

        // --- Ghosted check
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        if (tracking.sentAt < threeDaysAgo) {
          tracking.status = 'ghosted';
          await tracking.save();
        }
      } catch (err) {
        console.error(`Error checking tracking ${tracking._id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Job error:', err.message);
  }
}
checkEmailStatus();
cron.schedule('*/10 * * * *', checkEmailStatus);
// setInterval(checkEmailStatus, 10 * 1000);
