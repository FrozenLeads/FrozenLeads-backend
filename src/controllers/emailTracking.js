const UserLeadActivity = require('../models/UserLeadActivity');

const { getGmailClient, getMessageDetail } = require('../utils/gmailClient');



exports.startTracking = async (req, res) => {

  const { to } = req.body;

  const userId = req.user._id;



  try {

    const gmail = await getGmailClient(userId);



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

    const {

      subject,

      messageIdHeader,

      threadId,

      body

    } = await getMessageDetail(gmail, messageId);



    const existing = await UserLeadActivity.findOne({ user: userId, to, messageId });

    if (existing) {

      return res.status(200).json({

        message: 'Already tracking',

        trackingId: existing._id

      });

    }



    const tracking = new UserLeadActivity({

      user: userId,

      to,

      subject,

      body,

      messageId,

      messageIdHeader,

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

