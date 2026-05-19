const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { writeEvent } = require('../models/AuditLog');

function isPasswordExpired(user) {
  const rotationDays = Number(process.env.PASSWORD_ROTATION_DAYS || 90);
  const changedAt = new Date(user.passwordChangedAt || user.createdAt).getTime();
  const maxAgeMs = rotationDays * 24 * 60 * 60 * 1000;
  return Date.now() - changedAt > maxAgeMs;
}

passport.use(new LocalStrategy(
  {
    usernameField: 'email',
    passwordField: 'password',
    passReqToCallback: true
  },
  async (req, email, password, done) => {
    const ip = req.ip;
    try {
      const user = await User.findByEmail(email);

      if (!user) {
        await writeEvent('LOGIN_FAILED_UNKNOWN_USER', { email, ip });
        return done(null, false, { message: 'Невірний email або пароль' });
      }

      if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
        await writeEvent('LOGIN_BLOCKED_LOCKOUT', { userId: user.id, email: user.email, ip });
        return done(null, false, { message: 'Акаунт тимчасово заблоковано після невдалих спроб входу' });
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        await User.incrementFailedLogin(user.email);
        await writeEvent('LOGIN_FAILED_BAD_PASSWORD', { userId: user.id, email: user.email, ip });
        return done(null, false, { message: 'Невірний email або пароль' });
      }

      if (isPasswordExpired(user)) {
        await writeEvent('PASSWORD_ROTATION_REQUIRED', { userId: user.id, email: user.email, ip });
        return done(null, false, { message: 'Потрібно змінити пароль згідно політики mandatory password rotation' });
      }

      if (user.lastLoginIp && user.lastLoginIp !== ip) {
        await writeEvent('LOGIN_ANOMALY_NEW_IP', {
          userId: user.id,
          email: user.email,
          oldIp: user.lastLoginIp,
          newIp: ip
        });
      }

      const hour = new Date().getHours();
      if (hour < 6 || hour > 23) {
        await writeEvent('LOGIN_ANOMALY_UNUSUAL_TIME', { userId: user.id, email: user.email, ip, hour });
      }

      const updatedUser = await User.resetFailedLogins(user.id, ip);
      await writeEvent('LOGIN_SUCCESS', { userId: user.id, email: user.email, role: user.role, ip });
      return done(null, updatedUser);
    } catch (err) {
      return done(err);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user || false);
  } catch (err) {
    done(err);
  }
});

module.exports = passport;
