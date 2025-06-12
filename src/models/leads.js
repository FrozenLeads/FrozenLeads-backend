// models/Lead.js
const mongoose = require('mongoose');

const leadsSchema = new mongoose.Schema({
  leadName: {
    type: String,
    required: true,
    min: 4,
    max: 40,
    trim: true
  },
  LeadEmailId: {
    type: String,
    trim: true,
    validate: {
      validator: function(value) {
        return value || this.phone;
      },
      message: 'Either email or phone must be provided'
    }
  },
  phone: {
    type: String,
    trim: true,
    validate: {
      validator: function(value) {
        return value || this.LeadEmailId;
      },
      message: 'Either phone or email must be provided'
    }
  },
  source: {
    type: String,
    default: 'Linkedin.com',
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  collaborationGroup: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Collaboration',
    default: null
  },
  isPublic: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Lead', leadsSchema);
