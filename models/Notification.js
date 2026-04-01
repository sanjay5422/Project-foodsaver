const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['new_request', 'accepted', 'declined'],
        required: true
    },
    isRead: {
        type: Boolean,
        default: false
    },
    relatedRequestId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Request'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Notification', NotificationSchema);
