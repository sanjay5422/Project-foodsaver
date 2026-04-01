const express = require('express');
const router = express.Router();
const Request = require('../models/Request');
const FoodPost = require('../models/FoodPost');
const { protect } = require('../middleware/auth');

// GET /api/provider/analytics
router.get('/', protect, async (req, res) => {
    try {
        if (req.user.role !== 'Provider') {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const providerId = req.user._id;

        // Summary stats
        const totalPosts = await FoodPost.countDocuments({ providerId });
        const activePosts = await FoodPost.countDocuments({ providerId, status: 'Available' });
        const claimedPosts = await FoodPost.countDocuments({ providerId, status: 'Claimed' });
        const expiredPosts = await FoodPost.countDocuments({ providerId, status: 'Expired' });
        const totalRequests = await Request.countDocuments({ providerId });
        const acceptedRequests = await Request.countDocuments({ providerId, status: 'Accepted' });
        const declinedRequests = await Request.countDocuments({ providerId, status: 'Declined' });
        const pickedUp = await Request.countDocuments({ providerId, isPickedUp: true });

        // Monthly data (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const monthlyDonations = await FoodPost.aggregate([
            { $match: { providerId, createdAt: { $gte: sixMonthsAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
                    count: { $sum: 1 },
                    totalQuantity: { $sum: '$quantity' }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Top donated items
        const topItems = await FoodPost.aggregate([
            { $match: { providerId } },
            {
                $group: {
                    _id: '$foodName',
                    count: { $sum: 1 },
                    totalQuantity: { $sum: '$quantity' }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);

        // District breakdown
        const districtBreakdown = await FoodPost.aggregate([
            { $match: { providerId } },
            {
                $group: {
                    _id: '$district',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        res.json({
            success: true,
            data: {
                summary: { totalPosts, activePosts, claimedPosts, expiredPosts, totalRequests, acceptedRequests, declinedRequests, pickedUp },
                monthlyDonations,
                topItems,
                districtBreakdown
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
