const mongoose = require('mongoose');

const collaborationSchema = new mongoose.Schema({
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    collaborators: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    }],
    groupName: {
        type: String,
        default: 'Job Seeker'
    },
    createdAt: { type: Date, default: Date.now }
})

collaborationSchema.index({ owner: 1, groupName: 1 }, { unique: true });


collaborationSchema.pre('save', function (next) {
    if (this.collaborators.length > 10) {
        return next(new Error("Cannot have more than 10 collaborators"));
    }
    return next();
})

module.exports = mongoose.model('Collaboration', collaborationSchema);