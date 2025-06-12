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
    required: true
  },
  emailedAt: {
    type: Date,
    default: Date.now
  },
  responseReceivedAt: {
    type: Date
  },
  notes: {
    type: String,
    trim: true,
  },
  status: {
    type: String,
    enum: [
      'Emailed',
      'Waiting for Response',
      'Follow-up Needed',
      'Responded',
      'Not Interested',
      'Converted'
    ],
    default: 'Emailed'
  },
  followUpDate: {
    type: Date
  }
}, { timestamps: true });

module.exports = mongoose.model('UserLeadActivity', userLeadActivitySchema);
