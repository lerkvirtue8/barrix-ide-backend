const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    subscription: {
        plan: {
            type: String,
            enum: ['free', 'basic', 'standard', 'pro'],
            default: 'free'
        },
        stripeCustomerId: String,
        stripeSubscriptionId: String,
        stripePriceId: String,
        status: {
            type: String,
            enum: ['active', 'canceled', 'past_due', 'unpaid'],
            default: 'active'
        },
        currentPeriodStart: Date,
        currentPeriodEnd: Date
    },
    usage: {
        month: {
            type: String,
            default: () => new Date().toISOString().slice(0, 7)
        },
        apiCalls: {
            type: Number,
            default: 0
        },
        lastReset: {
            type: Date,
            default: Date.now
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

userSchema.methods.comparePassword = async function(password) {
    return await bcrypt.compare(password, this.password);
};

userSchema.methods.getUsageLimit = function() {
    const limits = {
        free: 10,
        basic: 100,
        standard: 500,
        pro: 2000
    };
    return limits[this.subscription.plan] || 10;
};

userSchema.methods.checkAndResetUsage = function() {
    const currentMonth = new Date().toISOString().slice(0, 7);
    if (this.usage.month !== currentMonth) {
        this.usage.month = currentMonth;
        this.usage.apiCalls = 0;
        this.usage.lastReset = new Date();
    }
};

module.exports = mongoose.model('User', userSchema);