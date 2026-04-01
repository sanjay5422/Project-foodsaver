const mongoose = require('mongoose');

const RequestSchema = new mongoose.Schema({
    foodPostId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FoodPost',
        required: true
    },
    providerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    recipientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    requestedQuantity: {
        type: Number,
        required: true
    },
    unit: {
        type: String,
        enum: ['Kg', 'Litre', 'Per Person'],
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Accepted', 'Declined'],
        default: 'Pending'
    },
    isPickedUp: {
        type: Boolean,
        default: false
    },
    pickedUpAt: {
        type: Date,
        default: null
    },
    rating: {
        type: Number,
        min: 1,
        max: 5,
        default: null
    },
    review: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Request', RequestSchema);
