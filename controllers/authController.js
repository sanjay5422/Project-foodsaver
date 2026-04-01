const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const transporter = require('../config/emailConfig');
const OTP = require('../models/OTP');

// Generate JWT Token
const generateToken = (id) => {
    console.log('Generating token with JWT_SECRET:', process.env.JWT_SECRET);
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res, next) => {
    try {
        const { name, email, password, role, contactNumber, district } = req.body;

        // Validation
        if (!name || !email || !password || !role || !contactNumber || !district) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        // Validate password length
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        // Check if user already exists
        const userExists = await User.findOne({ email: email.toLowerCase() });
        if (userExists) {
            return res.status(409).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Validate role
        const validRoles = ['Provider', 'Recipient', 'Admin'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role. Must be Provider, Recipient, or Admin'
            });
        }

        // Create user
        const user = await User.create({
            name: name.trim(),
            email: email.toLowerCase(),
            password, // Will be hashed by pre-save hook in model
            role,
            contactNumber: contactNumber.trim(),
            district: district.trim()
        });

        // Generate token
        const token = generateToken(user._id);

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                contactNumber: user.contactNumber,
                district: user.district,
                token: token
            }
        });

    } catch (error) {
        console.error('Register error:', error);
        next(error); // Pass error to error handler
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        // Fixed admin login (credentials come only from .env)
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (
            adminEmail &&
            adminPassword &&
            email.toLowerCase() === String(adminEmail).toLowerCase() &&
            password === String(adminPassword)
        ) {
            const normalizedAdminEmail = String(adminEmail).toLowerCase();
            const adminGoogleId = 'foodsaver_admin_fixed';

            // Create (or ensure) admin user exists, but do NOT store ADMIN_PASSWORD in DB.
            let adminUser = await User.findOne({ email: normalizedAdminEmail });
            if (!adminUser) {
                adminUser = await User.create({
                    name: 'Admin',
                    email: normalizedAdminEmail,
                    googleId: adminGoogleId,
                    role: 'Admin',
                    contactNumber: '0000000000',
                    district: 'Admin'
                });
            } else {
                // Ensure role + googleId are set; also best-effort remove password hash if it exists.
                await User.updateOne(
                    { _id: adminUser._id },
                    {
                        $set: {
                            googleId: adminGoogleId,
                            role: 'Admin',
                            contactNumber: '0000000000',
                            district: 'Admin',
                            name: 'Admin',
                            email: normalizedAdminEmail
                        },
                        $unset: { password: 1 }
                    }
                );
                adminUser = await User.findById(adminUser._id);
            }

            const token = generateToken(adminUser._id);
            return res.status(200).json({
                success: true,
                message: 'Admin login successful',
                data: {
                    _id: adminUser._id,
                    name: adminUser.name,
                    email: adminUser.email,
                    role: adminUser.role,
                    contactNumber: adminUser.contactNumber,
                    district: adminUser.district,
                    token: token
                }
            });
        }

        // Find user by email
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Block admin role from normal login attempts
        if (user.role === 'Admin') {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check password
        const passwordMatch = await user.comparePassword(password);

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Generate token
        const token = generateToken(user._id);

        // Remove password from user object before sending
        user.password = undefined;

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                contactNumber: user.contactNumber,
                district: user.district,
                token: token
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        next(error); // Pass error to error handler
    }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getCurrentUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);

        res.status(200).json({
            success: true,
            data: user
        });

    } catch (error) {
        console.error('Get user error:', error);
        next(error); // Pass error to error handler
    }
};

// @desc    Verify token
// @route   GET /api/auth/verify
// @access  Private
const verifyToken = async (req, res, next) => {
    try {
        res.status(200).json({
            success: true,
            message: 'Token is valid',
            data: req.user
        });

    } catch (error) {
        console.error('Token verify error:', error);
        next(error); // Pass error to error handler
    }
};

// @desc    Google auth callback
// @access  Public
const googleCallback = async (req, res) => {
    try {
        const user = req.user;
        
        console.log('Google callback user:', user);

        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        const role = user.role?.toLowerCase() || 'recipient';
        const name = encodeURIComponent(user.name || '');

        // Redirect to frontend with token
        res.redirect(
            `${process.env.CLIENT_URL || 'http://localhost:3000'}/auth/google/success` +
            `?token=${token}` +
            `&role=${role}` +
            `&name=${name}` 
        );
    } catch (err) {
        console.error('Google callback error:', err);
        res.redirect(
            `${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=auth_failed`
        );
    }
};

const sendOTP = async (req, res) => {
    try {
        const {
            name, email, password,
            role, mobile, location
        } = req.body;

        if (!name || !email || !password ||
            !mobile || !location) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid email address'
            });
        }

        const normalizedEmail = email.toLowerCase();
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered. Please login.'
            });
        }

        const otpCode = Math.floor(
            100000 + Math.random() * 900000
        ).toString();

        await OTP.deleteMany({ email: normalizedEmail });

        await OTP.create({
            email: normalizedEmail,
            otp: otpCode,
            userData: {
                name,
                email: normalizedEmail,
                password,
                role: role.toLowerCase(),
                mobile,
                location
            }
        });

        await transporter.sendMail({
            from: `"FoodSaver" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'FoodSaver - Email Verification OTP',
            html: `
        <div style="font-family:Arial,sans-serif;
                    max-width:500px;margin:0 auto;">
          <div style="background:#F97316;
                      padding:20px;text-align:center;">
            <h1 style="color:white;margin:0;">
              🍱 FoodSaver
            </h1>
          </div>
          <div style="padding:30px;background:#f9fafb;">
            <h2 style="color:#1f2937;">
              Verify Your Email
            </h2>
            <p style="color:#6b7280;">
              Hi ${name}! Your OTP:
            </p>
            <div style="background:white;
                        border:2px dashed #F97316;
                        border-radius:12px;
                        padding:24px;
                        text-align:center;
                        margin:20px 0;">
              <h1 style="color:#F97316;
                          font-size:42px;
                          letter-spacing:8px;
                          margin:0;">
                ${otpCode}
              </h1>
            </div>
            <p style="color:#EF4444;font-size:14px;">
              ⚠️ Expires in 5 minutes.
            </p>
          </div>
          <div style="background:#1f2937;
                      padding:16px;text-align:center;">
            <p style="color:#9ca3af;
                       font-size:13px;margin:0;">
              © 2024 FoodSaver
            </p>
          </div>
        </div>
      `
        });

        return res.json({
            success: true,
            message: 'OTP sent to ' + normalizedEmail
        });

    } catch (err) {
        console.error('SendOTP Error:', err.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to send OTP: ' + err.message
        });
    }
};

const verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        const normalizedEmail = email.toLowerCase();
        const otpRecord = await OTP.findOne({ email: normalizedEmail });

        if (!otpRecord) {
            return res.status(400).json({
                success: false,
                message: 'OTP expired. Please register again.'
            });
        }

        if (otpRecord.otp !== otp) {
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP. Please try again.'
            });
        }

        let user = await User.findOne({ email: normalizedEmail });

        if (!user) {
            const mappedRole = otpRecord.userData.role === 'provider'
                ? 'Provider'
                : otpRecord.userData.role === 'admin'
                    ? 'Admin'
                    : 'Recipient';
            user = await User.create({
                name: otpRecord.userData.name,
                email: otpRecord.userData.email,
                password: otpRecord.userData.password,
                role: mappedRole,
                contactNumber: otpRecord.userData.mobile,
                district: otpRecord.userData.location
            });
        }

        await OTP.deleteMany({ email: normalizedEmail });

        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        return res.json({
            success: true,
            message: 'Verified successfully!',
            token: token,
            role: user.role.toLowerCase(),
            name: user.name
        });

    } catch (err) {
        console.error('VerifyOTP Error:', err.message);
        return res.status(500).json({
            success: false,
            message: 'Verification failed: ' + err.message
        });
    }
};

const resendOTP = async (req, res) => {
    try {
        const { email } = req.body;

        const normalizedEmail = email.toLowerCase();
        const otpRecord = await OTP.findOne({ email: normalizedEmail });
        if (!otpRecord) {
            return res.status(400).json({
                success: false,
                message: 'Session expired. Please register again.'
            });
        }

        const newOTP = Math.floor(
            100000 + Math.random() * 900000
        ).toString();

        await OTP.findOneAndUpdate(
            { email: normalizedEmail },
            { otp: newOTP, createdAt: new Date() }
        );

        await transporter.sendMail({
            from: `"FoodSaver" <${process.env.EMAIL_USER}>`,
            to: normalizedEmail,
            subject: 'FoodSaver - New OTP',
            html: `
        <div style="font-family:Arial;
                    text-align:center;padding:30px;">
          <h2 style="color:#F97316;">🍱 FoodSaver</h2>
          <p>Your new OTP:</p>
          <h1 style="color:#F97316;
                      font-size:42px;
                      letter-spacing:8px;">
            ${newOTP}
          </h1>
          <p style="color:#EF4444;">
            Expires in 5 minutes.
          </p>
        </div>
      `
        });

        return res.json({
            success: true,
            message: 'New OTP sent!'
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Failed to resend OTP'
        });
    }
};

module.exports = {
    registerUser,
    loginUser,
    getCurrentUser,
    verifyToken,
    googleCallback,
    sendOTP,
    verifyOTP,
    resendOTP
};
