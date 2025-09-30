const mongoose = require('mongoose');



const userLeadActivitySchema = new mongoose.Schema({

    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },

    to: { type: String, required: true },

    subject: String,

    body: String,

    messageId: String,

    messageIdHeader: String,

    threadId: String,

    sentAt: Date,

    responseReceivedAt: Date,

    followUpSentAt: { type: Date, default: null },

    notes: { type: String, trim: true },

    status: {

        type: String,

        // --- 'Engaged' has been added to the list ---

        enum: [ 'sent', 'responded', 'ghosted', 'follow-up', 'not-interested', 'Engaged',"revived" ],

        default: 'sent'

    },

}, { timestamps: true });



module.exports = mongoose.model('UserLeadActivity', userLeadActivitySchema);