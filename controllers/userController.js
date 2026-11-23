const bcrypt = require('bcryptjs');
const User = require('../models/User');

exports.getMe = async (req, res) => {
  try {
    const u = await User.findById(req.user.id);
    if (!u) return res.status(404).json({ message: 'Not found' });
    const { password, ...safe } = u.toObject();
    res.json({ ...safe, hasPassword: typeof password === 'string' && password.length > 0 });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, bio, avatar, location, currentPassword, newPassword, language } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'Not found' });

    if (name) user.name = name.trim();
    if (phone !== undefined) user.phone = phone;
    if (bio !== undefined) user.bio = bio;
    if (avatar !== undefined) user.avatar = avatar;
    if (language) user.language = language;
    if (location)
      user.location = {
        city: location.city || user.location.city,
        lat: +(location.lat ?? user.location.lat),
        lng: +(location.lng ?? user.location.lng),
      };

    let passwordChanged = false;
    if (newPassword) {
      if (newPassword.length < 6)
        return res.status(400).json({ message: 'New password must be at least 6 characters.' });

      const hasExistingPassword = typeof user.password === 'string' && user.password.length > 0;

      if (hasExistingPassword) {
        if (!currentPassword) return res.status(400).json({ message: 'Current password is required.' });
        const matches = await bcrypt.compare(currentPassword, user.password);
        if (!matches) return res.status(401).json({ message: 'Current password is incorrect.' });
      }

      user.password = await bcrypt.hash(newPassword, 10);
      passwordChanged = true;
    }

    await user.save();
    const { password, ...safe } = user.toObject();
    res.json({
      message: passwordChanged
        ? user.authProvider === 'google'
          ? 'Password set successfully. You can now sign in with your email and password, or continue with Google.'
          : 'Password changed successfully.'
        : 'Profile updated.',
      user: { ...safe, hasPassword: typeof password === 'string' && password.length > 0 },
      passwordChanged,
    });
  } catch (e) {
    console.error('[PROFILE UPDATE]', e.message);
    res.status(500).json({ message: 'Unable to update your profile right now. Please try again.' });
  }
};

exports.updateLanguage = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { language: req.body.language });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
