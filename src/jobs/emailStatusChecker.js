// utils/statusChecker.js
const UserLeadActivity = require('../models/UserLeadActivity');
const { google } = require('googleapis');

async function checkEmailStatus() {
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
        id: tracking.threadId,
        format: 'metadata',
        metadataHeaders: ['In-Reply-To', 'From']
      });

      const messages = thread.data.messages || [];
      let replyMatched = false;

      for (const msg of messages) {
        const headers   = msg.payload?.headers || [];
        const fromHeader = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
        const inReplyTo  = headers.find(h => h.name === 'In-Reply-To')?.value;
        const fromEmail  = fromHeader.match(/<(.+?)>/)?.[1] || fromHeader;
        const sentTime   = Number(msg.internalDate);

        // Primary match: compare reply's In-Reply-To to stored RFC‑822 Message-ID
        if (inReplyTo === tracking.messageIdHeader) {
          replyMatched = true;
          break;
        }

        // Fallback: match by sender and timestamp if In-Reply-To is missing
        if (!inReplyTo &&
            fromEmail.toLowerCase() === tracking.to.toLowerCase() &&
            sentTime > tracking.sentAt.getTime()
        ) {
          replyMatched = true;
          break;
        }
      }

      if (replyMatched) {
        tracking.status = 'responded';
        tracking.responseReceivedAt = new Date();
        await tracking.save();
        continue;
      }

      // Ghosted check: no reply after 3 days
      const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
      if (tracking.sentAt.getTime() < threeDaysAgo) {
        tracking.status = 'ghosted';
        await tracking.save();
      }

    } catch (err) {
      console.error(`Error checking tracking ${tracking._id}:`, err.message);
    }
  }
}

module.exports = checkEmailStatus;
