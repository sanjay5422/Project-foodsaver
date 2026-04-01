const mongoose = require('mongoose');

const FoodPostSchema = new mongoose.Schema({
    providerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    organisationName: {
        type: String,
        required: true
    },
    foodName: {
        type: String,
        required: true
    },
    foodType: {
        type: String,
        enum: ['Veg', 'Non-Veg', 'Other'],
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    unit: {
        type: String,
        enum: ['Kg', 'Litre', 'Per Person'],
        required: true
    },
    mobileNumber: {
        type: String,
        required: true
    },
    district: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    coordinates: {
        lat: { type: Number },
        lng: { type: Number }
    },
    expiryDate: {
        type: Date,
        default: null
    },
    isExpired: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['Available', 'Claimed', 'Expired'],
        default: 'Available'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('FoodPost', FoodPostSchema);
