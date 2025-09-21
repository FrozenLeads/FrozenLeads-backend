const { google } = require('googleapis');

const User = require('../models/user');



/**

 * Sets up an authenticated Gmail client for the given userId.

 */

async function getGmailClient(userId) {

  const user = await User.findById(userId);

  if (!user || !user.googleTokens) {

    throw new Error('User not connected to Gmail');

  }



  const oAuth2Client = new google.auth.OAuth2(

    process.env.GOOGLE_CLIENT_ID,

    process.env.GOOGLE_CLIENT_SECRET,

    process.env.GOOGLE_REDIRECT_URI

  );



  oAuth2Client.setCredentials(user.googleTokens);



  if (oAuth2Client.isTokenExpiring && oAuth2Client.isTokenExpiring()) {

    const { credentials } = await oAuth2Client.refreshAccessToken();

    user.googleTokens = credentials;

    await user.save();

    oAuth2Client.setCredentials(credentials);

  }



  return google.gmail({ version: 'v1', auth: oAuth2Client });

}



/**

 * Gets full details and headers of a Gmail message.

 */

async function getMessageDetail(gmail, messageId) {

  const messageDetail = await gmail.users.messages.get({ userId: 'me', id: messageId });

  const headers = messageDetail.data.payload.headers;

  const subject = headers.find(h => h.name === 'Subject')?.value || '';

  const messageIdHeader = headers.find(h => h.name === 'Message-ID')?.value || '';

  const threadId = messageDetail.data.threadId;

  const body = Buffer.from(

    messageDetail.data.payload.parts?.[0]?.body?.data || '',

    'base64'

  ).toString('utf-8');



  return {

    subject,

    messageIdHeader,

    threadId,

    body,

    raw: messageDetail,

  };

}



module.exports = {

  getGmailClient,

  getMessageDetail,

};