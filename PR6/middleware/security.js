const { writeEvent } = require('../models/AuditLog');

const dangerousPatterns = [
  /<\s*script/i,
  /javascript:/i,
  /onerror\s*=/i,
  /union\s+select/i,
  /drop\s+table/i,
  /\.\.\//,
  /\$where/i
];

function sanitizeString(value) {
  return value
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .trim();
}

function sanitizeDeep(value) {
  if (typeof value === 'string') return sanitizeString(value);
  if (Array.isArray(value)) return value.map(sanitizeDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, sanitizeDeep(val)]));
  }
  return value;
}

function sanitizeInput(req, res, next) {
  req.body = sanitizeDeep(req.body || {});
  req.query = sanitizeDeep(req.query || {});
  req.params = sanitizeDeep(req.params || {});
  next();
}

async function intrusionDetection(req, res, next) {
  const payload = JSON.stringify({ body: req.body, query: req.query, params: req.params, url: req.originalUrl });
  const matched = dangerousPatterns.find((pattern) => pattern.test(payload));

  if (matched) {
    await writeEvent('IDS_SUSPICIOUS_REQUEST', {
      ip: req.ip,
      method: req.method,
      url: req.originalUrl,
      pattern: matched.toString(),
      userId: req.user ? req.user.id : null,
      userMessage: 'Система виявлення вторгнень зафіксувала підозрілий запит'
    });
  }

  next();
}

function ipWhitelist(req, res, next) {
  const whitelist = String(process.env.CRITICAL_IP_WHITELIST || '127.0.0.1,::1,::ffff:127.0.0.1')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);

  if (!whitelist.includes(req.ip)) {
    writeEvent('IP_WHITELIST_DENIED', {
      ip: req.ip,
      method: req.method,
      url: req.originalUrl,
      userId: req.user ? req.user.id : null
    });
    return res.status(403).json({ error: 'IP-адреса не дозволена для виконання критичної операції' });
  }

  next();
}

module.exports = { sanitizeInput, intrusionDetection, ipWhitelist };
