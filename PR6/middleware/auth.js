function isAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ error: 'Для виконання цієї дії потрібно увійти в систему' });
}

function hasRole(...roles) {
  return (req, res, next) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: 'Для виконання цієї дії потрібно увійти в систему' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Недостатньо прав доступу для цієї операції',
        requiredRoles: roles,
        currentRole: req.user.role
      });
    }

    return next();
  };
}

module.exports = { isAuthenticated, hasRole };
