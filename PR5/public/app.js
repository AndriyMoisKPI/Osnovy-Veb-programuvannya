// app.js
// Основна логіка клієнтської частини.
// Отримує дані з API та оновлює інтерфейс користувача.

// HTML-елементи, які оновлюються динамічно
const metricCards = document.getElementById('metricCards');
const qualityTable = document.getElementById('qualityTable');
const normIndicators = document.getElementById('normIndicators');
const connectionStatus = document.getElementById('connectionStatus');

// Форматування timestamp у локальний час
function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString('uk-UA');
}

// Вибір CSS-класу для текстового статусу в таблиці
function statusClass(status) {
  return status === 'Норма' ? 'status-ok' : 'status-bad';
}

// Вибір Bootstrap-класу для бейджа статусу
function badgeClass(status) {
  return status === 'Норма' ? 'text-bg-success' : 'text-bg-danger';
}

// Відображення карток з основними параметрами якості електроенергії
function renderMetricCards(data) {
  const cards = [
    { title: 'Відхилення напруги', value: data.voltageDeviation, unit: '%' },
    { title: 'Коефіцієнт несиметрії', value: data.unbalance, unit: '%' },
    { title: 'THD', value: data.thd, unit: '%' },
    { title: 'Фліккер', value: data.flicker, unit: 'Pst' },
    { title: 'Частота', value: data.frequency, unit: 'Гц' },
    { title: 'Індекс відповідності', value: data.qualityIndex, unit: '%' }
  ];

  // Формування HTML-карток на основі масиву cards
  metricCards.innerHTML = cards.map(card => `
    <div class="col-md-6 col-xl-4">
      <div class="card metric-card shadow-sm h-100">
        <div class="card-body">
          <div class="text-muted">${card.title}</div>
          <div class="metric-value">${card.value} <span class="fs-5">${card.unit}</span></div>
        </div>
      </div>
    </div>
  `).join('');
}

// Відображення таблиці показників якості
function renderTable(indicators) {
  qualityTable.innerHTML = indicators.map(item => `
    <tr>
      <td>${item.label}</td>
      <td>${item.value} ${item.unit}</td>
      <td>${item.limit}</td>
      <td class="${statusClass(item.status)}">${item.status}</td>
    </tr>
  `).join('');
}

// Відображення індикаторів відповідності нормам
function renderIndicators(indicators) {
  normIndicators.innerHTML = indicators.map(item => `
    <div class="norm-item">
      <div>
        <strong>${item.label}</strong><br>
        <span class="text-muted">${item.value} ${item.unit}; норма: ${item.limit}</span>
      </div>
      <span class="badge ${badgeClass(item.status)}">${item.status}</span>
    </div>
  `).join('');
}

// Основна функція оновлення dashboard.
// Отримує поточні дані з API та оновлює всі елементи інтерфейсу.
async function updateDashboard() {
  try {
    const data = await getCurrentQualityData();

    renderMetricCards(data);
    renderTable(data.indicators);
    renderIndicators(data.indicators);
    updateWaveformChart(data.waveform);
    updateHarmonicsChart(data.harmonics);

    // Оновлення статусу підключення
    connectionStatus.textContent = `Онлайн · ${formatTime(data.timestamp)}`;
    connectionStatus.className = 'badge text-bg-success';
  } catch (error) {
    // Обробка помилки API
    connectionStatus.textContent = 'Помилка API';
    connectionStatus.className = 'badge text-bg-danger';
    console.error(error);
  }
}

// Запуск логіки після завантаження HTML-документа
document.addEventListener('DOMContentLoaded', () => {
  // Спочатку створюємо графіки
  initCharts();

  // Потім виконуємо перше оновлення даних
  updateDashboard();

  // Далі автоматично оновлюємо дані кожні 2 секунди
  setInterval(updateDashboard, 2000);
});
