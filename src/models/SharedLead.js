// models/SharedLead.js

const mongoose = require('mongoose');
const sharedLeadSchema = new mongoose.Schema({
    lead: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lead',
        required: true,
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

sharedLeadSchema.index({ lead: 1, collaborationGroup: 1 }, { unique: true });
module.exports = mongoose.model('SharedLead', sharedLeadSchema);