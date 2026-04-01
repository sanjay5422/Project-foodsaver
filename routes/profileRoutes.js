const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const bcrypt = require('bcrypt');

// --- GET Profile ---
router.get('/me', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select('-password');
        if (!user) return res.status(404).json({
            success: false,
            message: 'User not found'
        });
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// --- UPDATE Profile ---
router.patch('/update', protect, async (req, res) => {
    try {
        const { name, mobile, location, bio } = req.body;

        if (mobile && !/^\d{10}$/.test(mobile)) {
            return res.status(400).json({
                success: false,
                message: 'Mobile must be 10 digits'
            });
        }

        const updated = await User.findByIdAndUpdate(
            req.user.id,
            { name, mobile, location, bio },
            { new: true }
        ).select('-password');

        res.json({ success: true, user: updated });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// --- CHANGE Password ---
router.patch('/change-password', protect, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'New passwords do not match'
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters'
            });
        }

        const user = await User.findById(req.user.id);
        const isMatch = await bcrypt.compare(currentPassword, user.password);

        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        const hashed = await bcrypt.hash(newPassword, 10);
        await User.findByIdAndUpdate(req.user.id, { password: hashed });

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
