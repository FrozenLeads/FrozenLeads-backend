const UserLeadActivity = require('../models/UserLeadActivity');
const User = require('../models/user');
const { google } = require('googleapis');

exports.startTracking = async (req, res) => {
  const { to } = req.body;
  const userId = req.user._id;

  try {
    const user = await User.findById(userId);
    if (!user || !user.googleTokens) {
      return res.status(400).json({ error: 'User not connected to Gmail' });
    }

    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oAuth2Client.setCredentials(user.googleTokens);
     if (oAuth2Client.isTokenExpiring()) {
      const { credentials } = await oAuth2Client.refreshAccessToken();
      user.googleTokens = credentials;
      await user.save();
      oAuth2Client.setCredentials(credentials);
    }
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

    // Fetch last email sent to this recipient
    const query = `to:${to}`;
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      labelIds: ['SENT'],
      maxResults: 1
    });

    const messages = response.data.messages || [];
    if (messages.length === 0) {
      return res.status(404).json({ error: 'No email found in sent folder' });
    }

    const messageId = messages[0].id;
    const messageDetail = await gmail.users.messages.get({ userId: 'me', id: messageId });
    const threadId = messageDetail.data.threadId; 
    const existing = await UserLeadActivity.findOne({
  user: userId,
  to,
  messageId
});
if (existing) {
  return res.status(200).json({
    message: 'Already tracking',
    trackingId: existing._id
  });
}

    const headers = messageDetail.data.payload.headers;
    const subject = headers.find(h => h.name === 'Subject')?.value || '';
    const body = Buffer.from(
      messageDetail.data.payload.parts?.[0]?.body?.data || '',
      'base64'
    ).toString('utf-8');

    const tracking = new UserLeadActivity({
      user: userId,
      to,
      subject,
      body,
      messageId,
      threadId,
      status: 'sent',
      sentAt: new Date()
    });

    await tracking.save();

    res.json({
      message: 'Tracking started',
      trackingId: tracking._id
    });
  } catch (err) {
    console.error('Tracking error:', err);
    res.status(500).json({ error: 'Failed to start tracking' });
  }
};




