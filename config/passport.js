const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

function configurePassport() {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: `${process.env.SERVER_URL || 'http://localhost:5000'}/api/auth/google/callback`,
          passReqToCallback: true,
        },
        async (req, accessToken, refreshToken, profile, done) => {
          try {
            // existing user by googleId
            let user = await User.findOne({ googleId: profile.id });
            if (user) return done(null, user);

            // existing user by email
            const email = profile.emails?.[0]?.value?.toLowerCase() || '';
            user = await User.findOne({ email });
            if (user) {
              user.googleId = profile.id;
              user.isEmailVerified = true;
              if (!user.avatar && profile.photos?.[0]?.value) user.avatar = profile.photos[0].value;
              await user.save();
              return done(null, user);
            }

            //new user
            const pendingProfile = {
              googleId: profile.id,
              name: profile.displayName || email.split('@')[0] || 'User',
              email,
              avatar: profile.photos?.[0]?.value || '',
            };
            // Attach pending flag; callback will detect user===null and pendingProfile set
            req.pendingGoogleProfile = pendingProfile;
            return done(null, false); // false → passport won't set req.user
          } catch (e) {
            done(e, null);
          }
        }
      )
    );
  }
}

module.exports = configurePassport;
