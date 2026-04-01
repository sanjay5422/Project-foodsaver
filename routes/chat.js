const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Request = require('../models/Request');
const { protect } = require('../middleware/auth');

// Get messages for a specific request
router.get('/:requestId', protect, async (req, res) => {
    try {
        const { requestId } = req.params;

        // Verify user is part of the request
        const request = await Request.findById(requestId);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        if (request.providerId.toString() !== req.user._id.toString() &&
            request.recipientId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to view these messages' });
        }

        const messages = await Message.find({ requestId }).sort({ createdAt: 1 });
        res.json({ success: true, data: messages });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
