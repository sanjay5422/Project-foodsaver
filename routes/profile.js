const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');

// POST /api/profile/upload - Upload profile photo
router.post('/upload', protect, upload.single('profilePhoto'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Please upload an image' });
        }

        const user = await User.findByIdAndUpdate(
            req.user._id,
            { profilePhoto: req.file.path },
            { new: true }
        ).select('-password');

        res.json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET /api/profile - Get profile
router.get('/', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        res.json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// PUT /api/profile - Update profile
router.put('/', protect, async (req, res) => {
    try {
        const { name, contactNumber, district, bio } = req.body;
        const updates = {};
        if (name) updates.name = name;
        if (contactNumber) updates.contactNumber = contactNumber;
        if (district) updates.district = district;
        if (bio !== undefined) updates.bio = bio;

        const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-password');
        res.json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// PUT /api/profile/password - Change password
router.put('/password', protect, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Please provide current and new password' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'New password must be at least 6 characters' });
        }

        const user = await User.findById(req.user._id);
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        user.password = newPassword;
        await user.save();
        res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
