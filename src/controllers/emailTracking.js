const EmailTracking = require('../models/EmailTracking');
const User = require('../models/user');
const { google } = require('googleapis');

// Start tracking an email
exports.startTracking = async (req, res) => {
  const { to, subject, body } = req.body;
  const userId = req.user._id;

  try {
    // Check if email exists in user's sent folder
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
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

    // Search for the email in user's sent folder
    const query = `to:${to} subject:"${subject}"`;
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      labelIds: ['SENT']
    });

    const messages = response.data.messages || [];
    if (messages.length === 0) {
      return res.status(404).json({ error: 'Email not found in your sent folder' });
    }

    // Create tracking record
    const tracking = new EmailTracking({
      user: userId,
      to,
      subject,
      body,
      messageId: messages[0].id,
      status: 'sent'
    });

    await tracking.save();
    
    res.json({
      message: 'Email tracking started',
      trackingId: tracking._id
    });
  } catch (err) {
    console.error('Tracking error:', err);
    res.status(500).json({ error: 'Failed to start tracking' });
  }
};

// Get tracking status
exports.getTrackingStatus = async (req, res) => {
  const { id } = req.params;
  
  try {
    const tracking = await EmailTracking.findById(id);
    if (!tracking) {
      return res.status(404).json({ error: 'Tracking not found' });
    }
    
    res.json(tracking);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};