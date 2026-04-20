// =======================
// Імпорти
// =======================
const express = require('express');
const cors = require('cors');
const path = require('path');

// =======================
// Ініціалізація додатку
// =======================
const app = express();
const PORT = 3000;

// =======================
// Глобальні змінні
// =======================
const apiStats = {};

const circuitBreakers = [
    {
        id: 1,
        name: "CB-110-1",
        voltage: 110,
        current: 1000,
        position: "open",
        switchingCount: 5,
        lastSwitching: new Date().toISOString(),
        mechanism: "spring",
        operationTime: 120,
        history: []
    },
    {
        id: 2,
        name: "CB-110-2",
        voltage: 110,
        current: 1200,
        position: "closed",
        switchingCount: 8,
        lastSwitching: new Date().toISOString(),
        mechanism: "hydraulic",
        operationTime: 95,
        history: []
    },
    {
        id: 3,
        name: "CB-220-1",
        voltage: 220,
        current: 2000,
        position: "open",
        switchingCount: 12,
        lastSwitching: new Date().toISOString(),
        mechanism: "motor",
        operationTime: 150,
        history: []
    },
    {
        id: 4,
        name: "CB-330-1",
        voltage: 330,
        current: 2500,
        position: "closed",
        switchingCount: 20,
        lastSwitching: new Date().toISOString(),
        mechanism: "spring",
        operationTime: 180,
        history: []
    },
    {
        id: 5,
        name: "CB-750-1",
        voltage: 750,
        current: 4000,
        position: "open",
        switchingCount: 3,
        lastSwitching: new Date().toISOString(),
        mechanism: "hydraulic",
        operationTime: 200,
        history: []
    }
];

// =======================
// Middleware
// =======================
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Логування
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Статистика API
app.use((req, res, next) => {
    const key = `${req.method} ${req.url}`;
    apiStats[key] = (apiStats[key] || 0) + 1;
    next();
});

// =======================
// Валідація
// =======================
function validateBreakerData(req, res, next) {
    const { name, voltage, current, position, mechanism, operationTime } = req.body;
    const errors = [];

    if (!name || typeof name !== 'string') {
        errors.push("Поле 'name' є обов'язковим і має бути рядком");
    }
    if (typeof voltage !== 'number') {
        errors.push("Поле 'voltage' має бути числом");
    }
    if (typeof current !== 'number') {
        errors.push("Поле 'current' має бути числом");
    }
    if (!["open", "closed"].includes(position)) {
        errors.push("Поле 'position' має бути 'open' або 'closed'");
    }
    if (!["spring", "hydraulic", "motor"].includes(mechanism)) {
        errors.push("Поле 'mechanism' має бути 'spring', 'hydraulic' або 'motor'");
    }
    if (typeof operationTime !== 'number') {
        errors.push("Поле 'operationTime' має бути числом");
    }

    if (errors.length) {
        return res.status(400).json({ message: "Помилка валідації", errors });
    }

    next();
}

// =======================
// ENDPOINTS
// =======================

// 1. GET всі з пагінацією, сортуванням, пошуком, фільтрацією
app.get('/api/circuit-breakers', (req, res) => {
    let data = [...circuitBreakers];

    const { page = 1, limit = 10, sortBy, sortOrder = 'asc', search, ...filters } = req.query;

    // Пошук
    if (search) {
        const s = search.toLowerCase();
        data = data.filter(item =>
            Object.values(item).some(val =>
                typeof val === 'string' && val.toLowerCase().includes(s)
            )
        );
    }

    // Фільтрація
    Object.keys(filters).forEach(key => {
        data = data.filter(item => String(item[key]) === String(filters[key]));
    });

    // Сортування
    if (sortBy) {
        data.sort((a, b) => {
            if (a[sortBy] < b[sortBy]) return sortOrder === 'asc' ? -1 : 1;
            if (a[sortBy] > b[sortBy]) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    }

    // Пагінація
    const p = parseInt(page);
    const l = parseInt(limit);
    const start = (p - 1) * l;
    const paginated = data.slice(start, start + l);

    res.json({
        data: paginated,
        total: data.length,
        page: p,
        totalPages: Math.ceil(data.length / l)
    });
});

// 2. GET по ID
app.get('/api/circuit-breakers/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const breaker = circuitBreakers.find(b => b.id === id);

    if (!breaker) {
        return res.status(404).json({ message: "Вимикач не знайдено" });
    }

    res.json(breaker);
});

// 3. POST створення
app.post('/api/circuit-breakers', validateBreakerData, (req, res) => {
    const newId = circuitBreakers.length
        ? Math.max(...circuitBreakers.map(b => b.id)) + 1
        : 1;

    const newBreaker = {
        id: newId,
        name: req.body.name,
        voltage: req.body.voltage,
        current: req.body.current,
        position: "open",
        switchingCount: 0,
        lastSwitching: new Date().toISOString(),
        mechanism: req.body.mechanism,
        operationTime: req.body.operationTime,
        history: []
    };

    circuitBreakers.push(newBreaker);
    res.status(201).json(newBreaker);
});

// 4. PUT оновлення
app.put('/api/circuit-breakers/:id', validateBreakerData, (req, res) => {
    const id = parseInt(req.params.id);
    const index = circuitBreakers.findIndex(b => b.id === id);

    if (index === -1) {
        return res.status(404).json({ message: "Вимикач не знайдено" });
    }

    circuitBreakers[index] = {
        ...circuitBreakers[index],
        ...req.body
    };

    res.json(circuitBreakers[index]);
});

// 5. DELETE
app.delete('/api/circuit-breakers/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const index = circuitBreakers.findIndex(b => b.id === id);

    if (index === -1) {
        return res.status(404).json({ message: "Вимикач не знайдено" });
    }

    const deleted = circuitBreakers.splice(index, 1);
    res.json(deleted[0]);
});

// 6. SWITCH
app.post('/api/circuit-breakers/:id/switch', (req, res) => {
    const id = parseInt(req.params.id);
    const breaker = circuitBreakers.find(b => b.id === id);

    if (!breaker) {
        return res.status(404).json({ message: "Вимикач не знайдено" });
    }

    const prev = breaker.position;
    const next = prev === "open" ? "closed" : "open";

    breaker.position = next;
    breaker.switchingCount += 1;
    breaker.lastSwitching = new Date().toISOString();

    breaker.history.push({
        date: breaker.lastSwitching,
        from: prev,
        to: next
    });

    res.json(breaker);
});

// 7. HISTORY
app.get('/api/circuit-breakers/:id/history', (req, res) => {
    const id = parseInt(req.params.id);
    const breaker = circuitBreakers.find(b => b.id === id);

    if (!breaker) {
        return res.status(404).json({ message: "Вимикач не знайдено" });
    }

    res.json(breaker.history);
});

// 8. STATS
app.get('/api/stats', (req, res) => {
    res.json(apiStats);
});

// =======================
// Обробка помилок
// =======================
app.use((req, res) => {
    res.status(404).json({ message: "Маршрут не знайдено" });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: "Внутрішня помилка сервера" });
});

// =======================
// Запуск
// =======================
app.listen(PORT, () => {
    console.log(`Сервер запущено: http://localhost:${PORT}`);
});

module.exports = { app, circuitBreakers, apiStats, validateBreakerData };