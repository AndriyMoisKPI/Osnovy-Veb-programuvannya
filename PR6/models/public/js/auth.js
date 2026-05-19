function showMessage(ok, text) {
  const result = document.getElementById('result');
  if (!result) return;
  result.className = `alert mt-3 ${ok ? 'alert-success' : 'alert-danger'}`;
  result.textContent = text;
}

function getUserMessage(json, fallback) {
  if (json && Array.isArray(json.details)) return json.details.join('; ');
  if (json && json.error) return json.error;
  if (json && json.message) return json.message;
  return fallback;
}

async function handleLogin(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  showMessage(true, 'Виконується вхід...');

  try {
    const response = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });

    const json = await response.json();
    if (!response.ok) {
      showMessage(false, getUserMessage(json, 'Сталася помилка під час входу.'));
      return;
    }

    showMessage(true, 'Вхід успішний. Перехід до панелі керування...');
    setTimeout(() => {
      window.location.href = '/dashboard.html';
    }, 600);
  } catch (error) {
    showMessage(false, 'Сервер недоступний. Перевірте, чи запущено застосунок.');
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));

  if (data.password !== data.passwordConfirm) {
    showMessage(false, 'Паролі не збігаються. Введіть однаковий пароль у двох полях.');
    return;
  }

  showMessage(true, 'Створення акаунту...');

  try {
    const response = await fetch('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });

    const json = await response.json();
    if (!response.ok) {
      showMessage(false, getUserMessage(json, 'Сталася помилка. Перевірте введені дані.'));
      return;
    }

    showMessage(true, 'Реєстрація успішна. Тепер можна увійти в акаунт.');
    event.target.reset();
  } catch (error) {
    showMessage(false, 'Сервер недоступний. Перевірте, чи запущено застосунок.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');

  if (loginForm) loginForm.addEventListener('submit', handleLogin);
  if (registerForm) registerForm.addEventListener('submit', handleRegister);
});
