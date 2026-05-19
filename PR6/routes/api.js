const express = require('express');
const { body, validationResult } = require('express-validator');
const { isAuthenticated, hasRole } = require('../middleware/auth');
const { ipWhitelist } = require('../middleware/security');
const { writeEvent, readEvents } = require('../models/AuditLog');

const router = express.Router();

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

router.use(isAuthenticated);

// GET /api/grid/balance — operator, analyst
router.get('/grid/balance',
  hasRole('operator', 'analyst'),
  async (req, res) => {
    await writeEvent('GRID_BALANCE_VIEW', { userId: req.user.id, role: req.user.role, ip: req.ip });
    res.json({
      message: 'Поточний баланс інтелектуальної енергомережі отримано',
      city: 'Kyiv Smart Grid Demo',
      timestamp: new Date().toISOString(),
      totalGenerationMW: 842.5,
      totalConsumptionMW: 818.2,
      reserveMW: 24.3,
      frequencyHz: 50.01,
      balanceStatus: 'стабільний',
      distributedGeneration: [
        { source: 'Сонячні дахові станції', generationMW: 126.4, status: 'норма' },
        { source: 'Північна вітрова зона', generationMW: 84.9, status: 'норма' },
        { source: 'Накопичувачі енергії', generationMW: 42.1, status: 'розряд' },
        { source: 'Когенераційні установки', generationMW: 589.1, status: 'норма' }
      ]
    });
  }
);

// POST /api/grid/adjust — operator + IP whitelist
router.post('/grid/adjust',
  hasRole('operator'),
  ipWhitelist,
  body('targetZone')
    .isLength({ min: 2, max: 50 }).withMessage('Зона керування має містити від 2 до 50 символів')
    .trim().escape(),
  body('adjustmentMW')
    .isFloat({ min: -100, max: 100 }).withMessage('Зміна потужності має бути числом від -100 до 100 МВт'),
  body('reason')
    .isLength({ min: 5, max: 300 }).withMessage('Причина коригування має містити від 5 до 300 символів')
    .trim().escape(),
  validationErrors,
  async (req, res) => {
    await writeEvent('GRID_ADJUSTMENT', {
      userId: req.user.id,
      role: req.user.role,
      ip: req.ip,
      payload: req.body
    });

    res.json({
      message: 'Команду коригування балансу прийнято оператором',
      operation: {
        targetZone: req.body.targetZone,
        adjustmentMW: Number(req.body.adjustmentMW),
        reason: req.body.reason,
        status: 'очікує виконання',
        createdAt: new Date().toISOString()
      }
    });
  }
);

// GET /api/forecasts — analyst
router.get('/forecasts',
  hasRole('analyst'),
  async (req, res) => {
    await writeEvent('FORECAST_VIEW', { userId: req.user.id, role: req.user.role, ip: req.ip });
    res.json({
      message: 'Прогноз навантаження та генерації побудовано',
      generatedAt: new Date().toISOString(),
      horizonHours: 24,
      model: 'demo-load-generation-forecast-v11',
      forecast: [
        { hour: '+1', demandMW: 821.4, generationMW: 848.0, risk: 'низький' },
        { hour: '+6', demandMW: 795.2, generationMW: 809.8, risk: 'низький' },
        { hour: '+12', demandMW: 902.7, generationMW: 887.5, risk: 'середній' },
        { hour: '+24', demandMW: 866.3, generationMW: 875.1, risk: 'низький' }
      ]
    });
  }
);

// POST /api/system/config — administrator + IP whitelist
router.post('/system/config',
  hasRole('administrator'),
  ipWhitelist,
  body('parameter')
    .isIn(['loadSheddingThreshold', 'forecastIntervalMinutes', 'idsSensitivity'])
    .withMessage('Оберіть допустимий параметр: loadSheddingThreshold, forecastIntervalMinutes або idsSensitivity'),
  body('value').notEmpty().withMessage('Введіть значення параметра'),
  validationErrors,
  async (req, res) => {
    await writeEvent('SYSTEM_CONFIG_CHANGED', {
      userId: req.user.id,
      role: req.user.role,
      ip: req.ip,
      payload: req.body
    });

    res.json({
      message: 'Системну конфігурацію оновлено адміністратором',
      config: {
        parameter: req.body.parameter,
        value: req.body.value,
        updatedBy: req.user.email,
        updatedAt: new Date().toISOString()
      }
    });
  }
);

// Додатковий службовий endpoint для демонстрації real-time intrusion detection та журналу подій.
router.get('/security/events',
  hasRole('administrator'),
  async (req, res) => {
    const events = await readEvents(50);
    res.json({ message: 'Журнал подій безпеки отримано', events });
  }
);

module.exports = router;
