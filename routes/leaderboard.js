const express = require('express');
const router = express.Router();
const Request = require('../models/Request');
const User = require('../models/User');
const FoodPost = require('../models/FoodPost');

// Get top providers by donations
router.get('/top-providers', async (req, res) => {
    try {
        const topProviders = await Request.aggregate([
            { $match: { status: 'Accepted' } },
            {
                $group: {
                    _id: '$providerId',
                    totalDonations: { $sum: 1 },
                    totalQuantity: { $sum: '$requestedQuantity' }
                }
            },
            { $sort: { totalDonations: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'provider'
                }
            },
            { $unwind: '$provider' },
            {
                $project: {
                    name: '$provider.name',
                    district: '$provider.district',
                    totalDonations: 1,
                    totalQuantity: 1,
                    averageRating: '$provider.averageRating'
                }
            }
        ]);

        res.json({ success: true, data: topProviders });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get top districts
router.get('/top-districts', async (req, res) => {
    try {
        const topDistricts = await FoodPost.aggregate([
            { $match: { status: { $in: ['Available', 'Claimed'] } } },
            {
                $group: {
                    _id: '$district',
                    totalPosts: { $sum: 1 },
                    totalQuantity: { $sum: '$quantity' }
                }
            },
            { $sort: { totalPosts: -1 } },
            { $limit: 10 }
        ]);

        res.json({ success: true, data: topDistricts });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get global impact stats
router.get('/stats', async (req, res) => {
    try {
        const totalProviders = await User.countDocuments({ role: 'Provider' });
        const totalRecipients = await User.countDocuments({ role: 'Recipient' });
        const totalPosts = await FoodPost.countDocuments();
        const totalAccepted = await Request.countDocuments({ status: 'Accepted' });
        const totalPickedUp = await Request.countDocuments({ isPickedUp: true });

        res.json({
            success: true, data: {
                totalProviders,
                totalRecipients,
                totalPosts,
                totalAccepted,
                totalPickedUp
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
