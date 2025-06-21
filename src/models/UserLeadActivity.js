const mongoose = require('mongoose');

const userLeadActivitySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    required: false // optional for manual tracking
  },
  threadId: {
   type: String
  },
  to: {
    type: String,
    required: true
  },
  subject: String,
  body: String,
  messageId: String,
  sentAt: Date,
  responseReceivedAt: Date,
  notes: {
    type: String,
    trim: true,
  },
  status: {
    type: String,
    enum: [
      'sent',
      'waiting',
      'follow-up',
      'responded',
      'not-interested',
      'converted',
      'ghosted'
    ],
    default: 'sent'
  },
  followUpDate: Date
}, { timestamps: true });

module.exports = mongoose.model('UserLeadActivity', userLeadActivitySchema);
