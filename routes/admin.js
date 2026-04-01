const express = require('express');
const router = express.Router();
const User = require('../models/User');
const FoodPost = require('../models/FoodPost');
const Request = require('../models/Request');
const { protect } = require('../middleware/auth');
const { adminMiddleware } = require('../middleware/adminMiddleware');

// Get admin dashboard statistics
router.get('/stats', protect, adminMiddleware, async (req, res) => {
    try {
        const totalProviders = await User.countDocuments({ role: 'Provider' });
        const totalRecipients = await User.countDocuments({ role: 'Recipient' });
        const totalFoodPosts = await FoodPost.countDocuments();
        const totalRequests = await Request.countDocuments();
        const acceptedRequests = await Request.countDocuments({ status: 'Accepted' });
        const declinedRequests = await Request.countDocuments({ status: 'Declined' });

        // Calculate total food saved (sum of accepted request quantities)
        const acceptedRequestsData = await Request.find({ status: 'Accepted' });
        const totalFoodSaved = acceptedRequestsData.reduce((total, request) => {
            return total + request.requestedQuantity;
        }, 0);

        // Requests per district
        const requestsByDistrict = await Request.aggregate([
            {
                $lookup: {
                    from: 'foodposts',
                    localField: 'foodPostId',
                    foreignField: '_id',
                    as: 'foodPost'
                }
            },
            { $unwind: '$foodPost' },
            {
                $group: {
                    _id: '$foodPost.district',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Monthly food saved (last 6 months)
        const monthlyFoodSaved = await Request.aggregate([
            {
                $match: {
                    status: 'Accepted',
                    createdAt: { $gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000) }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    totalFood: { $sum: '$requestedQuantity' }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        res.json({
            totalProviders,
            totalRecipients,
            totalFoodPosts,
            totalRequests,
            acceptedRequests,
            declinedRequests,
            totalFoodSaved,
            requestsByDistrict,
            monthlyFoodSaved
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get all users (for admin)
router.get('/users', protect, adminMiddleware, async (req, res) => {
    try {
        const users = await User.find({}).select('-password').sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get all food posts (for admin)
router.get('/foodposts', protect, adminMiddleware, async (req, res) => {
    try {
        const foodPosts = await FoodPost.find({})
            .populate('providerId', 'name email')
            .sort({ createdAt: -1 });
        res.json(foodPosts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
