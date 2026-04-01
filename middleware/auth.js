const jwt = require('jsonwebtoken');
const User = require('../models/User');

// @desc    Protect routes - verify JWT token
// @route   Used on protected routes
// @access  Private
const protect = async (req, res, next) => {
    let token;

    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    // Debug: Log token details
    console.log('Auth middleware - Token exists:', !!token);
    console.log('Auth middleware - Token preview:', token ? token.substring(0, 20) + '...' : 'none');
    console.log('Auth middleware - JWT_SECRET available:', !!process.env.JWT_SECRET);

    // Make sure token exists
    if (!token) {
        return res.status(401).json({ 
            success: false,
            message: 'Not authorized to access this route - No token provided' 
        });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Auth middleware - Token decoded successfully:', decoded.id);

        req.user = await User.findById(decoded.id);
        console.log('Auth middleware - User found:', !!req.user);

        if (!req.user) {
            return res.status(404).json({ 
                success: false,
                message: 'User not found' 
            });
        }

        next();

    } catch (error) {
        console.error('Token verification error:', error.message);
        console.error('JWT_SECRET used:', process.env.JWT_SECRET);
        return res.status(401).json({ 
            success: false,
            message: 'Not authorized to access this route - Invalid token' 
        });
    }
};

// @desc    Grant access to specific roles
// @route   Used on protected routes
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ 
                success: false,
                message: `User role '${req.user?.role}' is not authorized to access this route` 
            });
        }
        next();
    };
};

module.exports = { protect, authorize };
