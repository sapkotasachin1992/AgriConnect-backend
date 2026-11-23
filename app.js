const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const passport = require('passport');

const configurePassport = require('./config/passport');
const { UPLOADS_DIR } = require('./middlewares/uploadMiddleware');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const messageRoutes = require('./routes/messageRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const marketRoutes = require('./routes/marketRoutes');

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));
app.use('/uploads', express.static(UPLOADS_DIR));

configurePassport();
app.use(passport.initialize());

// ── API routes (each router declares its own sub-paths; full URLs are unchanged) ──
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api', recommendationRoutes); // /recommendations/event, /products/recommend
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api', messageRoutes); // /upload/chat, /messages/:id
app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', deliveryRoutes); // /nearest-farmers, /optimize-route/*
app.use('/api', analyticsRoutes); // /analytics, /ml/demand-forecast/:productId
app.use('/api', marketRoutes); // /market-insights

app.get('/api/health', (_, res) => res.json({ status: 'OK', version: '6.1' }));

module.exports = app;
