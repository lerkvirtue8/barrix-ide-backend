const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const usageRoutes = require('./routes/usage');
const paymentRoutes = require('./routes/payments');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS
app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true
}));

app.use(express.json());

// Prefer MONGODB_URI, fallback to MONGO_URL or MONGO_URI
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URL || process.env.MONGO_URI;
if (!mongoUri) {
    console.error('❌ Missing MongoDB URI: set MONGODB_URI or MONGO_URL in environment');
    console.error('Environment presence:', {
        MONGODB_URI: !!process.env.MONGODB_URI,
        MONGO_URL: !!process.env.MONGO_URL,
        MONGO_URI: !!process.env.MONGO_URI
    });
    process.exit(1);
}

mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('📦 Connected to MongoDB'))
.catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
});

app.use('/api/auth', authRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/payments', paymentRoutes);

app.get('/api/health', (req, res) => {
    res.json({ status: 'Server is running! 🔥', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`�� Barrix IDE Backend running on port ${PORT}`);
});
