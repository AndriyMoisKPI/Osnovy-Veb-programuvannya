// server.js
// Серверна частина проєкту "Моніторинг якості електроенергії".
// Відповідає за генерацію тестових даних, збереження історії
// та надання REST API для клієнтської частини.

// Підключення необхідних модулів
const express = require('express');
const cors = require('cors');
const path = require('path');

// Ініціалізація Express-застосунку
const app = express();
const PORT = 3000;

// Налаштування middleware
// cors() дозволяє виконувати запити до API.
// express.json() дозволяє серверу обробляти JSON.
// express.static() віддає файли клієнтської частини з папки public.
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Основні параметри пункту вимірювання
const NOMINAL_VOLTAGE = 230;
const NOMINAL_FREQUENCY = 50;
const HISTORY_LIMIT = 30;

// Масив для зберігання історії вимірювань
let history = [];

// Поточний набір даних, який повертається через API
let currentData = createMeasurement();

// Генерація випадкового числа у заданому діапазоні
function rand(min, max) {
  return min + Math.random() * (max - min);
}

// Округлення числа до заданої кількості знаків після коми
function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}

// Перевірка відповідності значення допустимим межам
// Якщо lowerLimit передано, перевіряється діапазон [lowerLimit; limit].
// Якщо lowerLimit не передано, перевіряється тільки верхня межа.
function getStatus(value, limit, lowerLimit = null) {
  if (lowerLimit !== null) {
    return value >= lowerLimit && value <= limit ? 'Норма' : 'Порушення';
  }
  return value <= limit ? 'Норма' : 'Порушення';
}

// Створення масиву точок форми сигналу напруги.
// Сигнал складається з основної синусоїди та додаткових гармонік,
// які імітують спотворення форми напруги.
function createWaveform(thd, frequency) {
  const points = [];
  const samples = 120;
  const amplitude = 325; // приблизно 230 В RMS * sqrt(2)

  for (let i = 0; i < samples; i++) {
    const timeMs = round((i / samples) * 40, 3); // 2 періоди для 50 Гц
    const t = timeMs / 1000;

    // Основна гармоніка
    const base = amplitude * Math.sin(2 * Math.PI * frequency * t);

    // Вищі гармоніки, які залежать від THD
    const h3 = amplitude * (thd / 100) * 0.45 * Math.sin(2 * Math.PI * 3 * frequency * t);
    const h5 = amplitude * (thd / 100) * 0.32 * Math.sin(2 * Math.PI * 5 * frequency * t);
    const h7 = amplitude * (thd / 100) * 0.18 * Math.sin(2 * Math.PI * 7 * frequency * t);

    points.push({ timeMs, voltage: round(base + h3 + h5 + h7, 1) });
  }

  return points;
}

// Створення даних для спектрального аналізу гармонік.
// Перша гармоніка приймається за 100%, а вищі гармоніки
// розраховуються відносно значення THD.
function createHarmonics(thd) {
  const base = 100;

  return [
    { order: 1, name: '1-ша', value: base },
    { order: 3, name: '3-тя', value: round(thd * rand(0.35, 0.48)) },
    { order: 5, name: '5-та', value: round(thd * rand(0.25, 0.36)) },
    { order: 7, name: '7-ма', value: round(thd * rand(0.12, 0.22)) },
    { order: 9, name: '9-та', value: round(thd * rand(0.05, 0.12)) },
    { order: 11, name: '11-та', value: round(thd * rand(0.02, 0.08)) }
  ];
}

// Формування одного повного вимірювання якості електроенергії
function createMeasurement() {
  // Генерація основних показників якості електроенергії
  const voltageDeviation = round(rand(-7.5, 7.5));
  const unbalance = round(rand(0.2, 3.2));
  const thd = round(rand(1.5, 8.5));
  const flicker = round(rand(0.25, 1.35));
  const frequency = round(rand(49.75, 50.25), 3);

  // Масив показників для таблиці та індикаторів відповідності нормам
  const indicators = [
    {
      key: 'voltageDeviation',
      label: 'Відхилення напруги',
      value: voltageDeviation,
      unit: '%',
      limit: '±10 %',
      status: getStatus(voltageDeviation, 10, -10)
    },
    {
      key: 'unbalance',
      label: 'Коефіцієнт несиметрії',
      value: unbalance,
      unit: '%',
      limit: '≤ 2 %',
      status: getStatus(unbalance, 2)
    },
    {
      key: 'thd',
      label: 'THD',
      value: thd,
      unit: '%',
      limit: '≤ 8 %',
      status: getStatus(thd, 8)
    },
    {
      key: 'flicker',
      label: 'Фліккер',
      value: flicker,
      unit: 'Pst',
      limit: '≤ 1.0',
      status: getStatus(flicker, 1)
    },
    {
      key: 'frequency',
      label: 'Частота',
      value: frequency,
      unit: 'Гц',
      limit: '49.8–50.2 Гц',
      status: getStatus(frequency, 50.2, 49.8)
    }
  ];

  // Індекс відповідності показує, скільки параметрів перебуває в нормі
  const qualityIndex = round((indicators.filter(i => i.status === 'Норма').length / indicators.length) * 100, 0);

  // Повний об'єкт поточного вимірювання
  return {
    timestamp: Date.now(),
    pointName: 'Пункт вимірювання PQ-11',
    nominalVoltage: NOMINAL_VOLTAGE,
    voltageDeviation,
    unbalance,
    thd,
    flicker,
    frequency,
    qualityIndex,
    indicators,
    waveform: createWaveform(thd, frequency),
    harmonics: createHarmonics(thd)
  };
}

// Оновлення поточного вимірювання та додавання запису в історію
function updateData() {
  currentData = createMeasurement();

  history.unshift({
    timestamp: currentData.timestamp,
    voltageDeviation: currentData.voltageDeviation,
    unbalance: currentData.unbalance,
    thd: currentData.thd,
    flicker: currentData.flicker,
    frequency: currentData.frequency,
    qualityIndex: currentData.qualityIndex
  });

  // Обмеження історії останніми HISTORY_LIMIT записами
  if (history.length > HISTORY_LIMIT) history = history.slice(0, HISTORY_LIMIT);
}

// Початкове заповнення історії
for (let i = 0; i < 10; i++) updateData();

// Автоматичне оновлення даних кожні 2 секунди
setInterval(updateData, 2000);

// Endpoint для отримання поточних показників якості електроенергії
app.get('/api/quality/current', (req, res) => {
  res.json(currentData);
});

// Endpoint для отримання історії вимірювань
app.get('/api/quality/history', (req, res) => {
  res.json(history);
});

// Endpoint для перевірки стану сервера
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    object: 'Пункт вимірювання якості електроенергії',
    uptime: round(process.uptime(), 1),
    lastUpdate: currentData.timestamp
  });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Сервер запущено: http://localhost:${PORT}`);
});
