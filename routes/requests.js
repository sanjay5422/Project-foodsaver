const express = require('express');
const router = express.Router();
const Request = require('../models/Request');
const FoodPost = require('../models/FoodPost');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');

// We need to require io and onlineUsers from server.js after they are exported. 
// A safer way is to export an emitter or require it lazily if module.exports structure permits.
// Since server.js exports an object, we can require it here.
const serverData = require('../server');

// Create new request (for recipients)
router.post('/', protect, async (req, res) => {
    try {
        if (req.user.role !== 'Recipient') {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const { foodPostId, requestedQuantity, unit } = req.body;

        const foodPost = await FoodPost.findById(foodPostId);
        if (!foodPost) {
            return res.status(404).json({ message: 'Food post not found' });
        }

        if (foodPost.status !== 'Available') {
            return res.status(400).json({ message: 'Food post is no longer available' });
        }

        const request = await Request.create({
            foodPostId,
            providerId: foodPost.providerId,
            recipientId: req.user._id,
            requestedQuantity,
            unit
        });

        const populatedRequest = await Request.findById(request._id)
            .populate('foodPostId', 'foodName organisationName district address mobileNumber')
            .populate('providerId', 'name email contactNumber')
            .populate('recipientId', 'name email contactNumber');

        // Create Notification for the Provider
        const message = `New food request received from ${populatedRequest.recipientId.name}`;
        const notification = await Notification.create({
            userId: request.providerId,
            message: message,
            type: 'new_request',
            relatedRequestId: request._id
        });

        // Emit via socket if online
        const { io, onlineUsers } = require('../server');
        if (io && onlineUsers && onlineUsers[request.providerId]) {
            io.to(onlineUsers[request.providerId]).emit('new_notification', {
                message,
                type: 'new_request',
                relatedRequestId: request._id,
                createdAt: notification.createdAt
            });
        }

        const result = populatedRequest.toObject();
        // New request is always Pending, so hide address and mobile
        if (result.foodPostId) {
            delete result.foodPostId.address;
            delete result.foodPostId.mobileNumber;
        }

        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get requests for provider (for providers)
router.get('/provider', protect, async (req, res) => {
    try {
        if (req.user.role !== 'Provider') {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const requests = await Request.find({ providerId: req.user._id })
            .populate('foodPostId', 'foodName organisationName district')
            .populate('recipientId', 'name email contactNumber district')
            .sort({ createdAt: -1 });

        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get requests for recipient (for recipients)
router.get('/recipient', protect, async (req, res) => {
    try {
        if (req.user.role !== 'Recipient') {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const requests = await Request.find({ recipientId: req.user._id })
            .populate('foodPostId', 'foodName organisationName district address mobileNumber')
            .populate('providerId', 'name email contactNumber district')
            .sort({ createdAt: -1 });

        const result = requests.map(req => {
            const data = req.toObject();
            if (data.status !== 'Accepted' && data.foodPostId) {
                delete data.foodPostId.address;
                delete data.foodPostId.mobileNumber;
            }
            return data;
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update request status (for providers)
router.put('/:id', protect, async (req, res) => {
    try {
        if (req.user.role !== 'Provider') {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const { status } = req.body;

        if (!['Accepted', 'Declined'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const request = await Request.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        if (request.providerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const updatedRequest = await Request.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        )
            .populate('foodPostId', 'foodName organisationName district')
            .populate('recipientId', 'name email contactNumber');

        // If request is accepted, update food post status to claimed
        if (status === 'Accepted') {
            await FoodPost.findByIdAndUpdate(request.foodPostId, { status: 'Claimed' });
        }

        // Create and Emit Notification for the Recipient
        const messageText = status === 'Accepted'
            ? `Your request for ${updatedRequest.foodPostId.foodName} has been ACCEPTED ✅`
            : `Your request for ${updatedRequest.foodPostId.foodName} was declined ❌`;

        const notification = await Notification.create({
            userId: updatedRequest.recipientId._id,
            message: messageText,
            type: status === 'Accepted' ? 'accepted' : 'declined',
            relatedRequestId: request._id
        });

        const { io, onlineUsers } = require('../server');
        if (io && onlineUsers && onlineUsers[updatedRequest.recipientId._id]) {
            io.to(onlineUsers[updatedRequest.recipientId._id]).emit('new_notification', {
                message: messageText,
                type: status === 'Accepted' ? 'accepted' : 'declined',
                relatedRequestId: request._id,
                createdAt: notification.createdAt
            });
        }

        res.json(updatedRequest);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Mark as picked up (for recipients)
router.patch('/:id/pickup', protect, async (req, res) => {
    try {
        if (req.user.role !== 'Recipient') {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const request = await Request.findById(req.params.id);
        if (!request) return res.status(404).json({ message: 'Request not found' });
        if (request.recipientId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }
        if (request.status !== 'Accepted') {
            return res.status(400).json({ message: 'Request must be accepted first' });
        }

        request.isPickedUp = true;
        request.pickedUpAt = Date.now();
        await request.save();

        res.json({ success: true, data: request });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Rate provider (for recipients)
router.post('/:id/rate', protect, async (req, res) => {
    try {
        if (req.user.role !== 'Recipient') {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const { rating, review } = req.body;
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ message: 'Please provide a valid rating between 1 and 5' });
        }

        const request = await Request.findById(req.params.id);
        if (!request) return res.status(404).json({ message: 'Request not found' });
        if (request.recipientId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }
        if (!request.isPickedUp) {
            return res.status(400).json({ message: 'Food must be picked up before rating' });
        }

        // Save rating
        request.rating = rating;
        if (review) request.review = review;
        await request.save();

        // Calculate and update provider average rating
        const User = require('../models/User');
        const allRatings = await Request.find({
            providerId: request.providerId,
            rating: { $ne: null }
        });

        const avg = allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length;

        await User.findByIdAndUpdate(request.providerId, {
            averageRating: avg.toFixed(1),
            totalRatings: allRatings.length
        });

        res.json({ success: true, data: request });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Mark as picked up (for recipients)
router.patch('/:id/pickup', protect, async (req, res) => {
    try {
        if (req.user.role !== 'Recipient') {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const request = await Request.findById(req.params.id);
        if (!request) return res.status(404).json({ message: 'Request not found' });
        if (request.recipientId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }
        if (request.status !== 'Accepted') {
            return res.status(400).json({ message: 'Request must be accepted first' });
        }

        request.isPickedUp = true;
        request.pickedUpAt = Date.now();
        await request.save();

        res.json({ success: true, data: request });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Rate provider (for recipients)
router.post('/:id/rate', protect, async (req, res) => {
    try {
        if (req.user.role !== 'Recipient') {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const { rating, review } = req.body;
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ message: 'Please provide a valid rating between 1 and 5' });
        }

        const request = await Request.findById(req.params.id);
        if (!request) return res.status(404).json({ message: 'Request not found' });
        if (request.recipientId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }
        if (!request.isPickedUp) {
            return res.status(400).json({ message: 'Food must be picked up before rating' });
        }

        // Save rating
        request.rating = rating;
        if (review) request.review = review;
        await request.save();

        // Calculate and update provider average rating
        const User = require('../models/User');
        const allRatings = await Request.find({
            providerId: request.providerId,
            rating: { $ne: null }
        });

        const avg = allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length;

        await User.findByIdAndUpdate(request.providerId, {
            averageRating: avg.toFixed(1),
            totalRatings: allRatings.length
        });

        res.json({ success: true, data: request });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get all requests (for admin)
router.get('/all', protect, async (req, res) => {
    try {
        if (req.user.role !== 'Admin') {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const requests = await Request.find({})
            .populate('foodPostId', 'foodName organisationName district')
            .populate('providerId', 'name email district')
            .populate('recipientId', 'name email district')
            .sort({ createdAt: -1 });

        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get statistics (for admin)
router.get('/stats', protect, async (req, res) => {
    try {
        if (req.user.role !== 'Admin') {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const totalRequests = await Request.countDocuments();
        const acceptedRequests = await Request.countDocuments({ status: 'Accepted' });
        const declinedRequests = await Request.countDocuments({ status: 'Declined' });
        const pendingRequests = await Request.countDocuments({ status: 'Pending' });

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

        res.json({
            totalRequests,
            acceptedRequests,
            declinedRequests,
            pendingRequests,
            totalFoodSaved,
            requestsByDistrict
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
