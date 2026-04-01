const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a name'],
        trim: true,
        maxlength: [100, 'Name cannot be more than 100 characters']
    },
    email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: true,
        lowercase: true,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Please add a valid email'
        ]
    },
    password: {
        type: String,
        required: function () {
            return !this.googleId; // Password required only if NOT a Google user
        },
        minlength: 6,
        select: false // Don't return password by default
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true,
        default: null
    },
    isGoogleUser: {
        type: Boolean,
        default: false
    },
    role: {
        type: String,
        enum: ['Provider', 'Recipient', 'Admin'],
        required: function () {
            return !this.googleId; // Required only if NOT a Google user
        }
    },
    contactNumber: {
        type: String,
        required: function () {
            return !this.googleId; // Required only if NOT a Google user
        },
        trim: true
    },
    district: {
        type: String,
        required: function () {
            return !this.googleId; // Required only if NOT a Google user
        },
        trim: true
    },
    averageRating: {
        type: Number,
        default: 0
    },
    totalRatings: {
        type: Number,
        default: 0
    },
    bio: {
        type: String,
        default: ''
    },
    profilePhoto: {
        type: String,
        default: null
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Hash password before saving
UserSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return;
    }
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
        throw error;
    }
});

// Compare password method
UserSchema.methods.comparePassword = async function (candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw new Error('Password comparison failed');
    }
};

module.exports = mongoose.model('User', UserSchema);
