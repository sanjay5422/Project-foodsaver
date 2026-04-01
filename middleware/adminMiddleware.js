const adminMiddleware = (req, res, next) => {
    const role = req.user?.role;
    if (!role || String(role).toLowerCase() !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Admin access only'
        });
    }
    next();
};

module.exports = { adminMiddleware };
