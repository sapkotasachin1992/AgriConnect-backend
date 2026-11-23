const mongoose = require('mongoose');

const User = mongoose.model(
  'User',
  new mongoose.Schema(
    {
      name: { type: String, required: true, trim: true },
      email: { type: String, required: true, unique: false, lowercase: true },
      password: { type: String }, // optional for OAuth users
      phone: { type: String, default: '' },
      role: { type: String, enum: ['Farmer', 'Consumer', 'Admin'], default: 'Consumer' },
      location: {
        city: { type: String, default: '' },
        lat: { type: Number, default: 27.7172 },
        lng: { type: Number, default: 85.324 },
      },
      avatar: { type: String, default: '' },
      bio: { type: String, default: '' },
      language: { type: String, enum: ['en', 'ne'], default: 'en' },
      viewHistory: [{ category: String, cropName: String, viewedAt: { type: Date, default: Date.now } }],
      // ── Email verification
      isEmailVerified: { type: Boolean, default: false },
      emailVerifyOTPHash: { type: String },
      emailVerifyExpiry: { type: Date },
      emailVerifyAttempts: { type: Number, default: 0 },
      // ── Password reset — same hashed-OTP + attempt-limit treatment
      resetPasswordOTPHash: { type: String },
      resetPasswordExpiry: { type: Date },
      resetPasswordAttempts: { type: Number, default: 0 },
      resetToken: { type: String },
      // ── OAuth
      googleId: { type: String },
      authProvider: { type: String, enum: ['local', 'google'], default: 'local' },

      isActive: { type: Boolean, default: true },
      deactivatedAt: { type: Date },
    },
    { timestamps: true }
  )
);

module.exports = User;
