const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const {
    registerUser,
    loginUser,
    getCurrentUser,
    verifyToken,
    googleCallback,
    sendOTP,
    verifyOTP,
    resendOTP
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);

// Protected routes
router.get('/me', protect, getCurrentUser);
router.get('/verify', protect, verifyToken);

const passport = require('passport');

// @desc    Auth with Google
// @route   GET /api/auth/google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// @desc    Google auth callback
// @route   GET /api/auth/google/callback
router.get(
    '/google/callback',
    passport.authenticate('google', {
        failureRedirect: `${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=failed`,
        session: false
    }),
    googleCallback
);

module.exports = router;
