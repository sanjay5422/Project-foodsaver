const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth');
const foodPostRoutes = require('./routes/foodposts');
const requestRoutes = require('./routes/requests');
const adminRoutes = require('./routes/admin');
const notificationRoutes = require('./routes/notifications');
const chatRoutes = require('./routes/chat');
const http = require('http');
const { Server } = require('socket.io');
const Message = require('./models/Message');
const startCronJobs = require('./cronJobs');

// Export io and onlineUsers for controllers to use
const onlineUsers = {};
let io;

dotenv.config();

// Debug: Check if JWT_SECRET is loaded
console.log('JWT_SECRET loaded:', process.env.JWT_SECRET ? 'YES' : 'NO');
console.log('JWT_SECRET value:', process.env.JWT_SECRET);

const passport = require('passport');
const session = require('express-session');

// Passport config
require('./config/passport')(passport);

const app = express();

// Sessions
app.use(
    session({
        secret: process.env.JWT_SECRET || 'keyboard cat',
        resave: false,
        saveUninitialized: false
    })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());
const server = http.createServer(app);

io = new Server(server, {
    cors: {
        origin: 'http://localhost:3000',
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
    }
});

io.on('connection', (socket) => {
    // console.log('A user connected:', socket.id);
    socket.on('register', (userId) => {
        onlineUsers[userId] = socket.id;
        // console.log(`User ${userId} registered with socket ${socket.id}`);
    });
    socket.on('disconnect', () => {
        Object.keys(onlineUsers).forEach(key => {
            if (onlineUsers[key] === socket.id) delete onlineUsers[key];
        });
        // console.log('A user disconnected:', socket.id);
    });

    // Chat Events
    socket.on('join_chat', (requestId) => {
        socket.join(requestId);
    });

    socket.on('leave_chat', (requestId) => {
        socket.leave(requestId);
    });

    socket.on('send_message', async (data) => {
        try {
            // Save to DB
            const newMessage = await Message.create({
                requestId: data.requestId,
                senderId: data.senderId,
                message: data.message
            });
            // Emit to everyone in the room (including sender, or sender handles locally)
            io.to(data.requestId).emit('receive_message', newMessage);
        } catch (error) {
            console.error('Socket message error:', error);
        }
    });
});

// Middleware - MUST be before routes
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/foodsaver')
    .then(() => {
        console.log('✓ MongoDB connected successfully');
        startCronJobs();
    })
    .catch(err => {
        console.error('✗ MongoDB connection error:', err.message);
        process.exit(1);
    });

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/foodposts', foodPostRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chat', chatRoutes);

const leaderboardRoutes = require('./routes/leaderboard');
app.use('/api/leaderboard', leaderboardRoutes);

const analyticsRoutes = require('./routes/analytics');
app.use('/api/provider/analytics', analyticsRoutes);

const profileRoutes = require('./routes/profileRoutes');
app.use('/api/profile', profileRoutes);

// Debug endpoint to test JWT
app.get('/api/debug-jwt', (req, res) => {
    const testToken = jwt.sign({ id: 'test123' }, process.env.JWT_SECRET);
    const decoded = jwt.verify(testToken, process.env.JWT_SECRET);

    res.json({
        jwt_secret_available: !!process.env.JWT_SECRET,
        jwt_secret_value: process.env.JWT_SECRET,
        test_token_generated: testToken.substring(0, 20) + '...',
        test_token_decoded: decoded,
        test_passed: decoded.id === 'test123'
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// errorHandler MUST be last - after ALL routes
app.use(errorHandler);

server.listen(5000, () => {
    console.log('Server running on port 5000');
});

module.exports = { app, server, io, onlineUsers };
