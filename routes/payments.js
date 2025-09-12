const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

const PLANS = {
    'price_1S1ey92NVoDUUEoeuvmjGtVn': { name: 'basic', price: 9.99, limit: 100 },
    'price_1S1ezv2NVoDUUEoeaRcSrjBt': { name: 'standard', price: 19.99, limit: 500 },
    'price_1S1f1H2NVoDUUEoeSFbgLGxO': { name: 'pro', price: 39.99, limit: 2000 }
};

router.post('/create-checkout', auth, async (req, res) => {
    try {
        const { priceId } = req.body;
        if (!PLANS[priceId]) {
            return res.status(400).json({ error: 'Invalid price ID' });
        }

        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        let customer;
        if (user.subscription.stripeCustomerId) {
            customer = user.subscription.stripeCustomerId;
        } else {
            const customerData = await stripe.customers.create({
                email: user.email,
                metadata: {
                    userId: user._id.toString()
                }
            });
            customer = customerData.id;
            user.subscription.stripeCustomerId = customer;
            await user.save();
        }

        const session = await stripe.checkout.sessions.create({
            customer: customer,
            line_items: [{
                price: priceId,
                quantity: 1
            }],
            mode: 'subscription',
            success_url: `${process.env.CLIENT_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.CLIENT_URL}/subscription/cancel`,
            metadata: {
                userId: user._id.toString()
            }
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        switch (event.type) {
            case 'customer.subscription.created':
            case 'customer.subscription.updated': {
                const subscription = event.data.object;
                const userId = subscription.metadata.userId;
                const user = await User.findById(userId);

                if (!user) {
                    console.error('User not found for subscription:', subscription.id);
                    return res.status(404).json({ error: 'User not found' });
                }

                const plan = Object.values(PLANS).find(p => p.price === subscription.plan.amount / 100);
                if (!plan) {
                    console.error('Plan not found for price:', subscription.plan.amount);
                    return res.status(404).json({ error: 'Plan not found' });
                }

                user.subscription.plan = plan.name;
                user.subscription.stripeSubscriptionId = subscription.id;
                user.subscription.stripePriceId = subscription.plan.id;
                user.subscription.status = subscription.status;
                user.subscription.currentPeriodStart = new Date(subscription.current_period_start * 1000);
                user.subscription.currentPeriodEnd = new Date(subscription.current_period_end * 1000);

                await user.save();
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                const userId = subscription.metadata.userId;
                const user = await User.findById(userId);

                if (user) {
                    user.subscription.plan = 'free';
                    user.subscription.stripeSubscriptionId = null;
                    user.subscription.stripePriceId = null;
                    user.subscription.status = 'canceled';
                    await user.save();
                }
                break;
            }
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

module.exports = router;