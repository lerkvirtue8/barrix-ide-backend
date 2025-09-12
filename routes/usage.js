const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/check', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        user.checkAndResetUsage();

        const limit = user.getUsageLimit();
        const remaining = Math.max(0, limit - user.usage.apiCalls);

        res.json({
            success: true,
            usage: {
                current: user.usage.apiCalls,
                limit: limit,
                remaining: remaining,
                plan: user.subscription.plan
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to check usage' });
    }
});

router.post('/track', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        user.checkAndResetUsage();
        const limit = user.getUsageLimit();

        if (user.usage.apiCalls >= limit) {
            return res.status(403).json({
                error: 'Usage limit exceeded',
                usage: {
                    current: user.usage.apiCalls,
                    limit: limit,
                    remaining: 0,
                    plan: user.subscription.plan
                }
            });
        }

        user.usage.apiCalls += 1;
        await user.save();

        const remaining = Math.max(0, limit - user.usage.apiCalls);

        res.json({
            success: true,
            usage: {
                current: user.usage.apiCalls,
                limit: limit,
                remaining: remaining,
                plan: user.subscription.plan
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to track usage' });
    }
});

module.exports = router;