const { google } = require('googleapis');
const User = require('../models/user');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify', // Critical for search
  'https://www.googleapis.com/auth/userinfo.email'
];

exports.generateAuthUrl = (req, res) => {
  const { code_challenge } = req.query; // Changed to single param

  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  const url = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES || SCOPES,
    code_challenge,
    code_challenge_method: 'S256'
  });

  res.json({ authUrl: url });
};

exports.gmailCallback = async (req, res) => {
  const { code, code_verifier } = req.body;

  try {
    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
     const requiredScopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify'
    ];
    

    const { tokens } = await oAuth2Client.getToken({
      code,
      codeVerifier: code_verifier,
    });

    oAuth2Client.setCredentials(tokens);

    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const gmailEmail = profile.data.emailAddress;

    // Fetch the logged-in user (from token middleware)
    const loggedInUser = await User.findById(req.user._id);

    if (!loggedInUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Optional: block if Gmail is different from signed-in email
    if (loggedInUser.emailId !== gmailEmail) {
      return res.status(403).json({
        error: 'Connected Gmail does not match your signed-in account',
        details: { signedInEmail: loggedInUser.emailId, gmailEmail },
      });
    }

    // Update current user with Gmail tokens
    loggedInUser.googleTokens = tokens;
    await loggedInUser.save();

    res.json({
      message: 'Google connected successfully',
      user: loggedInUser,
    });
  } catch (err) {
    console.error('Gmail callback error:', err.response?.data || err);
    res.status(400).json({
      error: 'Google Auth failed',
      details: err.response?.data?.error || err.message,
    });
  }
};



exports.syncGmail = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || !user.googleTokens) {
      return res.status(400).json({ error: 'No Gmail tokens found' });
    }

    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    oAuth2Client.setCredentials(user.googleTokens);

    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

    const messages = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 5 // Example
    });

    res.json({ message: 'Synced', messages: messages.data.messages || [] });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ error: 'Sync failed' });
  }
};
