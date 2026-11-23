const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const passport = require('passport');
const User = require('../models/User');
const { signToken } = require('../utils/generateToken');
const { makeOTP, hashOTP, MAX_OTP_ATTEMPTS } = require('../utils/otpUtils');
const { sendMail, OTP_HTML } = require('../services/emailService');
const { googleConfigured, signPending, verifyPending } = require('../services/authService');

exports.checkEmail = async (req, res) => {
  try {
    const { email } = req.query;
    res.json({ exists: !!(await User.exists({ email: email?.toLowerCase().trim() })) });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.register = async (req, res) => {
  try {
    const { name, email, password, role, location, phone } = req.body;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Invalid email' });
    if (await User.findOne({ email: email.toLowerCase() }))
      return res.status(409).json({ message: 'Email already registered' });
    if (!password || password.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    const otp = makeOTP();
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 min
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: await bcrypt.hash(password, 10),
      role,
      phone: phone || '',
      location: location || { city: '', lat: 27.7172, lng: 85.324 },
      isEmailVerified: false,
      emailVerifyOTPHash: hashOTP(otp),
      emailVerifyExpiry: expiry,
      authProvider: 'local',
    });
    const mailResult = await sendMail({
      to: email,
      subject: 'Verify your AgriConnect account',
      html: OTP_HTML(
        otp,
        'Verify Your Email',
        `Welcome to AgriConnect, ${name.trim()}! Enter the code below to activate your account.`
      ),
    });
    if (!mailResult.sent) {
      console.error(
        `⚠️  Registration succeeded for ${email} but verification email FAILED to send. User is stuck until SMTP is fixed or an admin manually verifies them.`
      );
    }
    res
      .status(201)
      .json({ needsVerification: true, email: email.toLowerCase().trim(), emailSent: mailResult.sent });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase().trim() });
    if (!user) return res.status(404).json({ message: 'Account not found' });
    if (user.isEmailVerified) return res.status(400).json({ message: 'Email already verified' });
    if (!user.emailVerifyOTPHash || !user.emailVerifyExpiry)
      return res.status(400).json({ message: 'No active code — please request a new one' });
    if (user.emailVerifyExpiry < new Date())
      return res.status(400).json({ message: 'Code expired — please request a new one' });
    if (user.emailVerifyAttempts >= MAX_OTP_ATTEMPTS) {
      user.emailVerifyOTPHash = undefined;
      user.emailVerifyExpiry = undefined;
      await user.save();
      return res.status(429).json({ message: 'Too many incorrect attempts. Please request a new code.' });
    }
    if (!otp || hashOTP(otp.trim()) !== user.emailVerifyOTPHash) {
      user.emailVerifyAttempts += 1;
      await user.save();
      const remaining = MAX_OTP_ATTEMPTS - user.emailVerifyAttempts;
      return res
        .status(400)
        .json({
          message:
            remaining > 0
              ? `Invalid verification code. ${remaining} attempt(s) remaining.`
              : 'Too many incorrect attempts. Please request a new code.',
        });
    }
    user.isEmailVerified = true;
    user.emailVerifyOTPHash = undefined;
    user.emailVerifyExpiry = undefined;
    user.emailVerifyAttempts = 0;
    await user.save();
    res.json({
      token: signToken(user),
      user: { id: user._id, name: user.name, role: user.role, language: user.language },
    });
  } catch (e) {
    console.error('[VERIFY EMAIL]', e.message);
    res.status(500).json({ message: 'Verification failed. Please try again.' });
  }
};

exports.resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase().trim() });
    if (!user) return res.status(404).json({ message: 'Account not found' });
    if (user.isEmailVerified) return res.status(400).json({ message: 'Email already verified' });
    const otp = makeOTP();
    user.emailVerifyOTPHash = hashOTP(otp);
    user.emailVerifyExpiry = new Date(Date.now() + 15 * 60 * 1000);
    user.emailVerifyAttempts = 0;
    await user.save();
    const mailResult = await sendMail({
      to: email,
      subject: 'Your new AgriConnect verification code',
      html: OTP_HTML(otp, 'New Verification Code', 'Here is your new verification code:'),
    });
    res.json({ sent: mailResult.sent });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase().trim() });
    if (!user) return res.status(401).json({ message: 'No account found with this email' });
    if (user.authProvider !== 'local')
      return res
        .status(401)
        .json({ message: `This account uses ${user.authProvider} sign-in. Please use that option.` });
    if (!(await bcrypt.compare(password, user.password || '')))
      return res.status(401).json({ message: 'Incorrect password' });
    if (!user.isEmailVerified) {
      // Resend a fresh OTP
      const otp = makeOTP();
      user.emailVerifyOTPHash = hashOTP(otp);
      user.emailVerifyExpiry = new Date(Date.now() + 15 * 60 * 1000);
      user.emailVerifyAttempts = 0;
      await user.save();
      const mailResult = await sendMail({
        to: user.email,
        subject: 'Verify your AgriConnect account',
        html: OTP_HTML(
          otp,
          'Verify Your Email',
          'Your account is not verified yet. Use the code below to verify.'
        ),
      });
      return res.status(403).json({
        needsVerification: true,
        email: user.email,
        emailSent: mailResult.sent,
        message: mailResult.sent
          ? 'Please verify your email first. A new code has been sent.'
          : 'Please verify your email first. We could not send a new code right now — please try "Resend code" in a moment, or contact support.',
      });
    }
    res.json({
      token: signToken(user),
      user: { id: user._id, name: user.name, role: user.role, language: user.language },
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase().trim(), authProvider: 'local' });
    if (!user) return res.status(404).json({ message: 'No account found with this email address' });
    const otp = makeOTP();
    user.resetPasswordOTPHash = hashOTP(otp);
    user.resetPasswordExpiry = new Date(Date.now() + 15 * 60 * 1000);
    user.resetPasswordAttempts = 0;
    await user.save();
    const mailResult = await sendMail({
      to: user.email,
      subject: 'Reset your AgriConnect password',
      html: OTP_HTML(otp, 'Reset Your Password', 'Enter the code below to reset your AgriConnect password.'),
    });
    res.json({ sent: mailResult.sent, email: user.email });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase().trim() });
    if (!user) return res.status(404).json({ message: 'Account not found' });
    if (!user.resetPasswordOTPHash || !user.resetPasswordExpiry)
      return res.status(400).json({ message: 'No active reset code — please request a new one' });
    if (user.resetPasswordExpiry < new Date())
      return res.status(400).json({ message: 'Code expired — request a new one' });
    if (user.resetPasswordAttempts >= MAX_OTP_ATTEMPTS) {
      user.resetPasswordOTPHash = undefined;
      user.resetPasswordExpiry = undefined;
      await user.save();
      return res.status(429).json({ message: 'Too many incorrect attempts. Please request a new code.' });
    }
    if (!otp || hashOTP(otp.trim()) !== user.resetPasswordOTPHash) {
      user.resetPasswordAttempts += 1;
      await user.save();
      const remaining = MAX_OTP_ATTEMPTS - user.resetPasswordAttempts;
      return res
        .status(400)
        .json({
          message:
            remaining > 0
              ? `Invalid reset code. ${remaining} attempt(s) remaining.`
              : 'Too many incorrect attempts. Please request a new code.',
        });
    }
    // Issue a short-lived reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetToken = resetToken;
    user.resetPasswordOTPHash = undefined;
    user.resetPasswordExpiry = undefined;
    user.resetPasswordAttempts = 0;
    await user.save();
    res.json({ valid: true, resetToken });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, resetToken, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    const user = await User.findOne({ email: email?.toLowerCase().trim(), resetToken });
    if (!user) return res.status(400).json({ message: 'Invalid or expired reset session' });
    user.password = await bcrypt.hash(newPassword, 10);
    user.resetToken = undefined;
    await user.save();
    res.json({ ok: true, message: 'Password reset successfully' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.googleAuth = (req, res, next) => {
  if (!googleConfigured)
    return res.redirect(
      `${process.env.CLIENT_URL || 'http://localhost:3000'}/auth?error=google_not_configured`
    );
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next);
};

exports.googleCallback = (req, res, next) => {
  if (!googleConfigured)
    return res.redirect(
      `${process.env.CLIENT_URL || 'http://localhost:3000'}/auth?error=google_not_configured`
    );

  passport.authenticate('google', { session: false, failWithError: true })(req, res, err => {
    if (err)
      return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/auth?error=google_failed`);

    // Existing user — normal JWT
    if (req.user) {
      const token = signToken(req.user);
      return res.redirect(
        `${process.env.CLIENT_URL || 'http://localhost:3000'}/auth/callback?token=${token}`
      );
    }

    // New user — redirect to role picker with a pending token
    if (req.pendingGoogleProfile) {
      const pendingToken = signPending(req.pendingGoogleProfile);
      return res.redirect(
        `${process.env.CLIENT_URL || 'http://localhost:3000'}/auth/callback?pending=${pendingToken}`
      );
    }

    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/auth?error=google_failed`);
  });
};

exports.googleComplete = async (req, res) => {
  try {
    const { pendingToken, role } = req.body;
    if (!pendingToken) return res.status(400).json({ message: 'Missing pending token' });
    if (!['Farmer', 'Consumer'].includes(role)) return res.status(400).json({ message: 'Invalid role' });

    const profile = verifyPending(pendingToken);
    if (!profile) return res.status(401).json({ message: 'Link expired — please sign in with Google again' });

    // Double-check no one registered in the meantime
    let user = await User.findOne({ googleId: profile.googleId });
    if (!user) user = await User.findOne({ email: profile.email });
    if (user) {
      // Already exists — just link & return token
      if (!user.googleId) {
        user.googleId = profile.googleId;
        user.isEmailVerified = true;
        await user.save();
      }
      return res.json({ token: signToken(user), user });
    }

    // Create the account with the chosen role
    user = await User.create({
      name: profile.name,
      email: profile.email,
      googleId: profile.googleId,
      authProvider: 'google',
      isEmailVerified: true,
      avatar: profile.avatar || '',
      role,
    });
    res.json({ token: signToken(user), user });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.configStatus = (_req, res) => {
  res.json({
    email: !!(process.env.SMTP_USER && !process.env.SMTP_USER.includes('your_')),
    google: googleConfigured,
  });
};
