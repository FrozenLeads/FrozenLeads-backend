// controllers/emailStatusChecker.js
const UserLeadActivity = require('../models/UserLeadActivity');
const { getGmailClient } = require('../utils/gmailClient');

exports.checkEmailStatus = async (req, res) => {
  const userId = req.user._id;

  try {
    const gmail = await getGmailClient(userId);

    // Get all unreplied/sent trackings
    const trackings = await UserLeadActivity.find({
      user: userId,
      status: { $nin: ['responded', 'ghosted', 'bounced'] }
    });

    // Get past replies to calculate adaptive threshold
    const pastReplies = await UserLeadActivity.find({
      user: userId,
      replyTimeInHours: { $ne: null }
    });

    let thresholdHours = 0.0083; // default
    if (pastReplies.length >= 10) {
      const avg = pastReplies.reduce((sum, doc) => sum + doc.replyTimeInHours, 0) / pastReplies.length;
      thresholdHours = Math.round(avg);
    }

    // ⏱ override for test: 3 seconds = 0.00083 hours
    const testOverride = true;
    if (testOverride) thresholdHours = 0.00083;

    // But never below 48h in real use
    if (!testOverride) thresholdHours = Math.max(thresholdHours, 48);

    for (const tracking of trackings) {
      const { messageIdHeader, threadId, sentAt, _id } = tracking;
      if (!messageIdHeader || !threadId || !sentAt) continue;

      // Fetch thread messages
      const thread = await gmail.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'metadata',
        metadataHeaders: ['In-Reply-To', 'From', 'Date']
      });

      let replyMatched = false;

      for (const msg of thread.data.messages || []) {
        const headers = msg.payload?.headers || [];
        const inReplyTo = headers.find(h => h.name === 'In-Reply-To')?.value;
        const from = headers.find(h => h.name === 'From')?.value;
        const dateHeader = headers.find(h => h.name === 'Date')?.value;
        const msgDate = new Date(dateHeader);

        // Check for matching reply
        if (inReplyTo === messageIdHeader) {
          const now = new Date();
          const replyTimeMs = now - new Date(sentAt);
          const replyTimeInHours = Math.round(replyTimeMs / (1000 * 60 * 60));

          tracking.status = 'responded';
          tracking.responseReceivedAt = msgDate;
          tracking.replyTimeInHours = replyTimeInHours;
          await tracking.save();
          console.log(`✅ Replied (${_id}) in ${replyTimeInHours}h`);
          replyMatched = true;
          break;
        }
      }

      if (!replyMatched) {
        const ghostCutoff = Date.now() - thresholdHours * 60 * 60 * 1000;
        const sentAtTime = new Date(sentAt).getTime();

        // Debug logging
        console.log(`⏱ Checking ghost: sentAt=${sentAtTime}, ghostCutoff=${ghostCutoff}`);

        if (sentAtTime < ghostCutoff) {
          tracking.status = 'ghosted';
          await tracking.save();
          console.log(`👻 Ghosted (${_id}) after ${thresholdHours}h`);
        }
      }
    }

    res.json({ message: 'Status sync complete' });

  } catch (err) {
    console.error('❌ Email sync error:', err);
    res.status(500).json({ error: 'Failed to sync email statuses' });
  }
};
