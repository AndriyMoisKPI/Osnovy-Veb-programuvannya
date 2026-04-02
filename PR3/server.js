const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'contracts.json');

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Створення файлу та директорії
async function initDataFile() {
    try {
        await fs.access(DATA_FILE);
    } catch (error) {
        await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
        await fs.writeFile(DATA_FILE, JSON.stringify([]));
    }
}

// Читання JSON
async function readContracts() {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
}

// Запис JSON
async function writeContracts(data) {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

// GET: Отримання списку
app.get('/api/contracts', async (req, res) => {
    try {
        const contracts = await readContracts();
        res.json(contracts);
    } catch (error) {
        res.status(500).json({ error: 'Помилка сервера під час читання даних' });
    }
});

// POST: Додавання договору
app.post('/api/contracts', async (req, res) => {
    try {
        const { number, customer, targetObject, cost, savingsPercentage, durationMonths } = req.body;

        // Валідація числових значень
        if (typeof cost !== 'number' || cost <= 0) {
            return res.status(400).json({ error: 'Вартість контракту має бути позитивним числом' });
        }
        if (typeof savingsPercentage !== 'number' || savingsPercentage <= 0) {
            return res.status(400).json({ error: 'Процент економії має бути позитивним числом' });
        }

        const newContract = {
            id: crypto.randomUUID(),
            number,
            customer,
            targetObject,
            cost,
            savingsPercentage,
            durationMonths
        };

        const contracts = await readContracts();
        contracts.push(newContract);
        await writeContracts(contracts);

        res.status(201).json(newContract);
    } catch (error) {
        res.status(500).json({ error: 'Помилка сервера під час збереження даних' });
    }
});

// DELETE: Видалення за ID
app.delete('/api/contracts/:id', async (req, res) => {
    try {
        const contracts = await readContracts();
        const filteredContracts = contracts.filter(c => c.id !== req.params.id);

        if (contracts.length === filteredContracts.length) {
            return res.status(404).json({ error: 'Договір не знайдено' });
        }

        await writeContracts(filteredContracts);
        res.json({ message: 'Договір успішно видалено' });
    } catch (error) {
        res.status(500).json({ error: 'Помилка сервера під час видалення даних' });
    }
});

// Ініціалізація та запуск
initDataFile()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Сервер запущено на порту ${PORT}`);
        });
    })
    .catch(err => {
        console.error('Критична помилка ініціалізації бази даних:', err);
    });
