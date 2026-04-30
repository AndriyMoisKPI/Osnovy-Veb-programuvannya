// charts.js
// Модуль створення та оновлення графіків Chart.js.

// Змінні для збереження об'єктів графіків
let waveformChart;
let harmonicsChart;

// Ініціалізація графіка форми сигналу напруги
// та графіка спектрального аналізу гармонік
function initCharts() {
  const waveformCtx = document.getElementById('waveformChart').getContext('2d');

  // Лінійний графік форми сигналу напруги
  waveformChart = new Chart(waveformCtx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Напруга, В',
        data: [],
        borderColor: '#0d6efd',
        backgroundColor: 'rgba(13, 110, 253, 0.12)',
        pointRadius: 0,
        tension: 0.25
      }]
    },
    options: {
      responsive: true,
      animation: false,
      scales: {
        x: { title: { display: true, text: 'Час, мс' } },
        y: { title: { display: true, text: 'Напруга, В' } }
      }
    }
  });

  const harmonicsCtx = document.getElementById('harmonicsChart').getContext('2d');

  // Стовпчастий графік амплітуд гармонік
  harmonicsChart = new Chart(harmonicsCtx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{
        label: 'Амплітуда, % від основної гармоніки',
        data: [],
        backgroundColor: 'rgba(13, 110, 253, 0.65)',
        borderColor: '#0d6efd',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      animation: false,
      scales: {
        x: { title: { display: true, text: 'Номер гармоніки' } },
        y: { beginAtZero: true, title: { display: true, text: '%' } }
      }
    }
  });
}

// Оновлення графіка форми сигналу напруги
function updateWaveformChart(waveform) {
  // Підписи по осі X — час у мілісекундах
  waveformChart.data.labels = waveform.map(point => point.timeMs);

  // Дані по осі Y — значення напруги
  waveformChart.data.datasets[0].data = waveform.map(point => point.voltage);

  waveformChart.update();
}

// Оновлення графіка спектрального аналізу гармонік
function updateHarmonicsChart(harmonics) {
  // Підписи по осі X — назви гармонік
  harmonicsChart.data.labels = harmonics.map(item => item.name);

  // Значення по осі Y — амплітуди гармонік
  harmonicsChart.data.datasets[0].data = harmonics.map(item => item.value);

  harmonicsChart.update();
}
