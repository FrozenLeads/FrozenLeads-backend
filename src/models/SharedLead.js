// models/SharedLead.js
const mongoose = require('mongoose');

const sharedLeadSchema = new mongoose.Schema({
  lead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    required: true,
    unique: true  // ensures a lead can be shared only once
  },
  sharedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  collaborationGroup: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Collaboration',
    required: true
  }
}, { timestamps: true });

// Optional: Create a compound index to enforce uniqueness of lead per group (if a lead can only appear once per group)
sharedLeadSchema.index({ lead: 1, collaborationGroup: 1 }, { unique: true });

module.exports = mongoose.model('SharedLead', sharedLeadSchema);
