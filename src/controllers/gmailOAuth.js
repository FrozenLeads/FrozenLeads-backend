const { google } = require('googleapis');
const User = require('../models/user');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.metadata',
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
    scope: SCOPES,
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

    // CORRECTED: Use 'codeVerifier' instead of 'code_verifier'
    const { tokens } = await oAuth2Client.getToken({ 
      code, 
      codeVerifier: code_verifier  // This is the critical fix
    });
    
    oAuth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const email = profile.data.emailAddress;

    const user = await User.findOneAndUpdate(
      { emailId: email },
      { googleTokens: tokens },
      { new: true, upsert: true }
    );

    res.json({
      message: 'Google connected successfully',
      user
    });
  } catch (err) {
    console.error('Gmail callback error:', err.response?.data || err);
    res.status(400).json({ 
      error: 'Google Auth failed', 
      details: err.response?.data?.error || err.message 
    });
  }
};