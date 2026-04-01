const express = require('express');
const router = express.Router();
const FoodPost = require('../models/FoodPost');
const { protect } = require('../middleware/auth');
const NodeGeocoder = require('node-geocoder');

const geocoderOptions = {
    provider: 'google',
    apiKey: process.env.GOOGLE_MAPS_API_KEY,
    formatter: null
};
const geocoder = NodeGeocoder(geocoderOptions);

// Get all food posts (for recipients)
router.get('/', async (req, res, next) => {
    try {
        const { district, search, foodType, unit, sort } = req.query;
        let query = { status: 'Available', isExpired: { $ne: true } };

        if (district) query.district = district;
        if (foodType) query.foodType = foodType;
        if (unit) query.unit = unit;
        if (search) {
            query.$or = [
                { foodName: { $regex: search, $options: 'i' } },
                { organisationName: { $regex: search, $options: 'i' } }
            ];
        }

        let sortOption = { createdAt: -1 };
        if (sort === 'quantity_asc') sortOption = { quantity: 1 };
        if (sort === 'quantity_desc') sortOption = { quantity: -1 };
        if (sort === 'oldest') sortOption = { createdAt: 1 };

        const foodPosts = await FoodPost.find(query)
            .select('-address -mobileNumber')
            .populate('providerId', 'name email contactNumber')
            .sort(sortOption);

        res.json({
            success: true,
            data: foodPosts
        });
    } catch (error) {
        console.error('Error fetching food posts:', error);
        next(error);
    }
});

// Get food posts by provider (for providers)
router.get('/my-posts', protect, async (req, res, next) => {
    try {
        if (req.user.role !== 'Provider') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }

        const foodPosts = await FoodPost.find({ providerId: req.user._id })
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: foodPosts
        });
    } catch (error) {
        console.error('Error fetching provider posts:', error);
        next(error);
    }
});

// Create new food post (for providers)
router.post('/', protect, async (req, res, next) => {
    try {
        if (req.user.role !== 'Provider') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized - Only providers can create food posts'
            });
        }

        const {
            organisationName,
            foodName,
            foodType,
            quantity,
            unit,
            mobileNumber,
            district,
            address
        } = req.body;

        // Validation
        if (!organisationName || !foodName || !foodType || !quantity || !unit || !mobileNumber || !district || !address) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields'
            });
        }

        // Convert quantity to number
        const quantityNum = Number(quantity);
        if (isNaN(quantityNum) || quantityNum <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Quantity must be a positive number'
            });
        }

        const foodPost = await FoodPost.create({
            providerId: req.user._id,
            organisationName: organisationName.trim(),
            foodName: foodName.trim(),
            foodType,
            quantity: quantityNum,
            unit,
            mobileNumber: mobileNumber.trim(),
            district: district.trim(),
            address: address.trim(),
            expiryDate: req.body.expiryDate || null
        });

        res.status(201).json({
            success: true,
            message: 'Food post created successfully',
            data: foodPost
        });
    } catch (error) {
        console.error('Error creating food post:', error);
        next(error);
    }
});

// Update food post (for providers)
router.put('/:id', protect, async (req, res) => {
    try {
        const foodPost = await FoodPost.findById(req.params.id);

        if (!foodPost) {
            return res.status(404).json({ message: 'Food post not found' });
        }

        if (foodPost.providerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const updatedFoodPost = await FoodPost.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        res.json(updatedFoodPost);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Delete food post (for providers)
router.delete('/:id', protect, async (req, res) => {
    try {
        const foodPost = await FoodPost.findById(req.params.id);

        if (!foodPost) {
            return res.status(404).json({ message: 'Food post not found' });
        }

        if (foodPost.providerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        await foodPost.deleteOne();
        res.json({ message: 'Food post deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get all districts for filter
router.get('/districts/list', async (req, res) => {
    try {
        const districts = await FoodPost.distinct('district');
        res.json(districts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
