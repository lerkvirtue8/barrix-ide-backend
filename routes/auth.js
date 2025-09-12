const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const user = new User({ email, password });
        await user.save();

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({
            success: true,
            token,
            user: {
                id: user._id,
                email: user.email,
                subscription: user.subscription,
                usage: {
                    apiCalls: user.usage.apiCalls,
                    limit: user.getUsageLimit()
                }
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        user.checkAndResetUsage();
        await user.save();

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                email: user.email,
                subscription: user.subscription,
                usage: {
                    apiCalls: user.usage.apiCalls,
                    limit: user.getUsageLimit()
                }
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Login failed' });
    }
});

router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        user.checkAndResetUsage();
        await user.save();

        res.json({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                subscription: user.subscription,
                usage: {
                    apiCalls: user.usage.apiCalls,
                    limit: user.getUsageLimit()
                }
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to get user data' });
    }
});

module.exports = router;