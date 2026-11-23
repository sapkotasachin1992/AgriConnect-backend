const mongoose = require('mongoose');

/** Connects to MongoDB (same URI/fallback as before). Resolves once connected. */
const connectDB = () =>
  mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/agri-marketplace-v6').then(() => {
    console.log('✅  MongoDB connected');
  });

module.exports = connectDB;
