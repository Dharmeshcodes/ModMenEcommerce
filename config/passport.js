const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require("../models/userSchema");
require("dotenv").config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.CALLBACK_URL || "http://localhost:7711/auth/google/callback",
      passReqToCallback: true
    },
    async (request, accessToken, refreshToken, profile, done) => {
      try {
        // Check by BOTH googleId AND email
        let user = await User.findOne({
          $or: [
            { googleId: profile.id },
            { email: profile.emails[0].value }
          ]
        });

        if (user) {
          // User exists - update googleId if it's not set
          if (!user.googleId) {
            user.googleId = profile.id;
            await user.save();
          }
          return done(null, user);
        } else {
          // Truly new user - create account with error handling
          try {
            user = new User({
              googleId: profile.id,
              fullName: profile.displayName,
              email: profile.emails[0].value
            });
            await user.save();
            return done(null, user);
          } catch (saveError) {
            // If duplicate key error, try to find and link the existing user
            if (saveError.code === 11000) {
              console.log('Duplicate key error, attempting to link existing account...');
              user = await User.findOneAndUpdate(
                { email: profile.emails[0].value },
                { 
                  $set: { 
                    googleId: profile.id,
                    fullName: profile.displayName 
                  } 
                },
                { new: true }
              );
              
              if (user) {
                return done(null, user);
              }
            }
            throw saveError;
          }
        }
      } catch (error) {
        console.error('Google auth error:', error);
        return done(error, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;