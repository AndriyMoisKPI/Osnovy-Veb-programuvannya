function getElement(id) {
  return document.getElementById(id);
}

function setStatus(id, text, type = 'muted') {
  const box = getElement(id);
  if (!box) return;
  box.className = `small mt-2 text-${type}`;
  box.textContent = text;
}

function showGlobal(text, type = 'warning') {
  const box = getElement('globalMessage');
  if (!box) return;
  box.className = `alert alert-${type}`;
  box.textContent = text;
}

async function api(url, options = {}) {
  try {
    const response = await fetch(url, {
      credentials: 'include',
      cache: 'no-store',
      ...options
    });

    let json;
    try {
      json = await response.json();
    } catch (err) {
      json = { error: 'Сервер повернув некоректну відповідь.' };
    }

    return { ok: response.ok, status: response.status, json };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      json: { error: 'Не вдалося з’єднатися із сервером. Перевірте, чи запущено npm start.' }
    };
  }
}

function userMessage(data) {
  const json = data.json || data || {};
  if (json.details && Array.isArray(json.details)) return json.details.join('; ');
  return json.error || json.message || 'Операцію виконано.';
}

function printResult(id, data) {
  const box = getElement(id);
  if (!box) return;

  const payload = data.ok
    ? data.json
    : {
        статус: data.status,
        помилка: userMessage(data)
      };

  box.textContent = JSON.stringify(payload, null, 2);
}

async function runRequest(resultId, statusId, url, options = {}) {
  setStatus(statusId, 'Виконується запит...', 'primary');
  printResult(resultId, { ok: true, json: { повідомлення: 'Очікування відповіді сервера...' } });

  const result = await api(url, options);
  printResult(resultId, result);

  if (result.ok) {
    setStatus(statusId, userMessage(result), 'success');
  } else {
    setStatus(statusId, userMessage(result), 'danger');
  }
}

async function loadStatus() {
  const data = await api('/auth/status');

  if (!data.ok || !data.json.authenticated) {
    location.href = '/login.html';
    return;
  }

  const user = data.json.user;
  getElement('userInfo').textContent = `${user.name} | ${user.email} | роль: ${user.role}`;
  showGlobal('Панель завантажено. Натисніть потрібну кнопку, щоб виконати запит до API.', 'success');
}

function setupHandlers() {
  getElement('balanceBtn').addEventListener('click', () => {
    runRequest('balance', 'balanceStatus', '/api/grid/balance');
  });

  getElement('forecastsBtn').addEventListener('click', () => {
    runRequest('forecasts', 'forecastsStatus', '/api/forecasts');
  });

  getElement('eventsBtn').addEventListener('click', () => {
    runRequest('events', 'eventsStatus', '/api/security/events');
  });

  getElement('adjustForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    data.adjustmentMW = Number(data.adjustmentMW);

    runRequest('adjust', 'adjustStatus', '/api/grid/adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  });

  getElement('configForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));

    runRequest('config', 'configStatus', '/api/system/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  });

  getElement('passwordForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));

    if (data.newPassword !== data.newPasswordConfirm) {
      const result = { ok: false, status: 400, json: { error: 'Нові паролі не збігаються.' } };
      printResult('passwordResult', result);
      setStatus('passwordResultStatus', 'Нові паролі не збігаються.', 'danger');
      return;
    }

    runRequest('passwordResult', 'passwordResultStatus', '/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  });

  getElement('logoutBtn').addEventListener('click', async () => {
    await api('/auth/logout', { method: 'POST' });
    location.href = '/login.html';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupHandlers();
  loadStatus();
});
