const { getGmailClient } = require('../utils/gmailClient');
const UserLeadActivity = require('../models/UserLeadActivity');
const Lead = require('../models/leads');

// Helper function to extract the pure email address from a string
const extractEmail = (emailString) => {
    if (!emailString) return '';
    // This regex looks for content inside <...> brackets
    const match = emailString.match(/<(.+)>/);
    // If it finds a match, it returns the content; otherwise, it returns the original string
    return match ? match[1] : emailString;
};

exports.listDrafts = async (req, res) => {
    // This function is correct and remains unchanged.
    try {
        const gmail = await getGmailClient(req.user._id);
        const response = await gmail.users.drafts.list({ userId: 'me' });
        if (!response.data.drafts || response.data.drafts.length === 0) return res.json([]);
        const draftDetails = await Promise.all(
            response.data.drafts.map(async (draft) => {
                const detail = await gmail.users.drafts.get({ userId: 'me', id: draft.id });
                const headers = detail.data.message.payload.headers;
                const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
                const to = headers.find(h => h.name.toLowerCase() === 'to')?.value || '(No Recipient)';
                return { id: draft.id, subject, to };
            })
        );
        res.json(draftDetails);
    } catch (error) {
        console.error('Failed to list drafts:', error);
        res.status(500).json({ error: 'Could not fetch drafts.' });
    }
};

exports.sendFromDraft = async (req, res) => {
    const { draftId } = req.body;
    const userId = req.user._id;
    try {
        const gmail = await getGmailClient(userId);
        const draftResponse = await gmail.users.drafts.get({ userId: 'me', id: draftId });
        const draftMessage = draftResponse.data.message;
        const headers = draftMessage.payload.headers;

        // --- THE FIX IS APPLIED HERE ---
        const toHeader = headers.find(h => h.name.toLowerCase() === 'to')?.value;
        const to = extractEmail(toHeader); // Use the helper to get a clean email
        // --- END OF FIX ---

        const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value;
        const draftMessageIdHeader = headers.find(h => h.name.toLowerCase() === 'message-id')?.value;
        
        if (!to) {
            return res.status(400).json({ error: 'Draft must have a recipient in the "To" field.' });
        }

        let body = '';
        if (draftMessage.payload.parts) {
            const part = draftMessage.payload.parts.find(p => p.mimeType === 'text/html');
            if (part && part.body.data) body = Buffer.from(part.body.data, 'base64').toString('utf-8');
        } else if (draftMessage.payload.body?.data) {
            body = Buffer.from(draftMessage.payload.body.data, 'base64').toString('utf-8');
        }
        
        const tracking = new UserLeadActivity({
            user: userId, 
            to, // Now using the clean 'to' variable
            subject, 
            body,
            status: 'sent',
            sentAt: new Date(),
            messageIdHeader: draftMessageIdHeader,
        });
        
        // This save() was part of a previous bug. We save once at the end.
        // await tracking.save(); 

        const fullBody = body;
        const filteredHeaders = headers.filter(h => h.name.toLowerCase() !== 'content-type' && h.name.toLowerCase() !== 'mime-version');
        let email = `Content-Type: text/html; charset="UTF-8"\r\n`;
        email += `MIME-Version: 1.0\r\n`;
        filteredHeaders.forEach(header => { email += `${header.name}: ${header.value}\r\n`; });
        email += '\r\n' + fullBody;
        
        const base64EncodedEmail = Buffer.from(email).toString('base64url');
        
        const sendResponse = await gmail.users.messages.send({
            userId: 'me',
            requestBody: { raw: base64EncodedEmail }
        });
        
        const finalMessageId = sendResponse.data.id;
        const finalMessage = await gmail.users.messages.get({ userId: 'me', id: finalMessageId, format: 'metadata', metadataHeaders: ['Message-ID'] });
        const finalMessageIdHeader = finalMessage.data.payload.headers.find(h => h.name === 'Message-ID')?.value;
        
        tracking.messageId = finalMessageId;
        tracking.threadId = sendResponse.data.threadId;
        if (finalMessageIdHeader) {
            tracking.messageIdHeader = finalMessageIdHeader;
        }

        // Save the complete tracking document once
        await tracking.save();

        const existingLead = await Lead.findOne({ 
            LeadEmailId: tracking.to.toLowerCase(), 
            user: req.user._id 
        });

        if (!existingLead) {
            const newLead = new Lead({
                leadName: tracking.to,
                LeadEmailId: tracking.to,
                user: req.user._id,
                origin: 'tracked',
                isPublic: true
            });
            await newLead.save();
            console.log(`✅ Automatically created a new lead for ${tracking.to}`);
        }
        
        await gmail.users.drafts.delete({ userId: 'me', id: draftId });
        
        res.status(200).json({ message: 'Draft sent and is now being tracked.', trackingId: tracking._id });
    } catch (error) {
        console.error('Failed to send from draft:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Could not send email from draft.' });
    }
};