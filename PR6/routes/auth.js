const express = require('express');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { writeEvent } = require('../models/AuditLog');
const { isAuthenticated } = require('../middleware/auth');

const router = express.Router();
const allowedRoles = ['operator', 'analyst', 'administrator'];

function validationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Помилка валідації даних',
      details: errors.array().map((item) => item.msg)
    });
  }
  next();
}

const passwordRules = [
  body('password')
    .isLength({ min: 10 }).withMessage('Пароль має містити мінімум 10 символів')
    .matches(/[A-ZА-ЯІЇЄҐ]/).withMessage('Пароль має містити хоча б одну велику літеру')
    .matches(/[a-zа-яіїєґ]/).withMessage('Пароль має містити хоча б одну малу літеру')
    .matches(/[0-9]/).withMessage('Пароль має містити хоча б одну цифру'),
  body('passwordConfirm')
    .notEmpty().withMessage('Повторіть пароль')
    .custom((value, { req }) => value === req.body.password).withMessage('Паролі не збігаються')
];

const newPasswordRules = [
  body('newPassword')
    .isLength({ min: 10 }).withMessage('Новий пароль має містити мінімум 10 символів')
    .matches(/[A-ZА-ЯІЇЄҐ]/).withMessage('Новий пароль має містити хоча б одну велику літеру')
    .matches(/[a-zа-яіїєґ]/).withMessage('Новий пароль має містити хоча б одну малу літеру')
    .matches(/[0-9]/).withMessage('Новий пароль має містити хоча б одну цифру'),
  body('newPasswordConfirm')
    .notEmpty().withMessage('Повторіть новий пароль')
    .custom((value, { req }) => value === req.body.newPassword).withMessage('Нові паролі не збігаються')
];

router.post('/register',
  body('name')
    .isLength({ min: 2, max: 80 }).withMessage('ПІБ має містити від 2 до 80 символів')
    .trim().escape(),
  body('email')
    .isEmail().withMessage('Введіть коректний email')
    .normalizeEmail(),
  ...passwordRules,
  body('role')
    .isIn(allowedRoles).withMessage('Оберіть одну з ролей: operator, analyst або administrator'),
  validationErrors,
  async (req, res) => {
    try {
      const { name, email, password, role } = req.body;
      const passwordHash = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS || 10));
      const user = await User.create({ name, email, passwordHash, role });
      await writeEvent('REGISTER_SUCCESS', { userId: user.id, email: user.email, role: user.role, ip: req.ip });
      res.status(201).json({ message: 'Реєстрація успішна. Тепер можна виконати вхід.', user: User.toPublic(user) });
    } catch (err) {
      await writeEvent('REGISTER_FAILED', { email: req.body.email, ip: req.ip, reason: err.message });
      res.status(err.status || 500).json({ error: err.userMessage || err.message || 'Не вдалося створити акаунт' });
    }
  }
);

router.post('/login',
  body('email').isEmail().withMessage('Введіть коректний email').normalizeEmail(),
  body('password').notEmpty().withMessage('Введіть пароль'),
  validationErrors,
  (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ error: info && info.message ? info.message : 'Не вдалося виконати вхід' });
      }

      req.login(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        return res.json({ message: 'Вхід успішний', user: User.toPublic(user) });
      });
    })(req, res, next);
  }
);

router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: 'Не вдалося завершити сеанс' });
    res.json({ message: 'Вихід успішний' });
  });
});

router.post('/change-password',
  isAuthenticated,
  body('oldPassword').notEmpty().withMessage('Введіть поточний пароль'),
  ...newPasswordRules,
  validationErrors,
  async (req, res) => {
    const isMatch = await bcrypt.compare(req.body.oldPassword, req.user.passwordHash);
    if (!isMatch) {
      await writeEvent('PASSWORD_CHANGE_FAILED', { userId: req.user.id, ip: req.ip });
      return res.status(400).json({ error: 'Поточний пароль неправильний' });
    }

    const passwordHash = await bcrypt.hash(req.body.newPassword, Number(process.env.BCRYPT_ROUNDS || 10));
    const user = await User.update(req.user.id, {
      passwordHash,
      passwordChangedAt: new Date().toISOString()
    });

    await writeEvent('PASSWORD_CHANGED', { userId: user.id, email: user.email, ip: req.ip });
    res.json({ message: 'Пароль змінено. Політика обов’язкової ротації виконана.', user: User.toPublic(user) });
  }
);

router.get('/status', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.json({ authenticated: true, user: User.toPublic(req.user) });
  }
  res.json({ authenticated: false });
});

module.exports = router;
