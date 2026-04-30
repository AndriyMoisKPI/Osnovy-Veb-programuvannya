// api.js
// Модуль роботи з REST API.
// Містить функції для отримання поточних даних,
// історії вимірювань та стану сервера.

// Базова адреса API
const API_BASE = 'http://localhost:3000/api';

// Отримання поточних показників якості електроенергії
async function getCurrentQualityData() {
  const response = await fetch(`${API_BASE}/quality/current`);

  // Якщо сервер повернув помилку, генеруємо виняток
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  // Повертаємо відповідь у форматі JSON
  return response.json();
}

// Отримання історії вимірювань
async function getHistoryData() {
  const response = await fetch(`${API_BASE}/quality/history`);

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  return response.json();
}

// Отримання службової інформації про стан сервера
async function getServerStatus() {
  const response = await fetch(`${API_BASE}/status`);

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  return response.json();
}
