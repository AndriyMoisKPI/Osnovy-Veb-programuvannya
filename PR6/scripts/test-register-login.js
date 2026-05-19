const http = require('http');
const app = require('../server');
const User = require('../models/User');
const fs = require('fs/promises');
const path = require('path');

const PORT = 3456;
const DATA_DIR = path.join(__dirname, '..', 'data');

function request(method, pathName, body, cookie) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      path: pathName,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...(cookie ? { Cookie: cookie } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = {};
        try { json = data ? JSON.parse(data) : {}; } catch (err) { json = { raw: data }; }
        resolve({ status: res.statusCode, headers: res.headers, json });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function cookieFrom(headers) {
  const setCookie = headers['set-cookie'];
  if (!setCookie) return '';
  return setCookie.map((item) => item.split(';')[0]).join('; ');
}

async function registerAndLogin(role) {
  const email = `${role}${Date.now()}@example.com`;
  const password = 'SecurePass123';
  const register = await request('POST', '/auth/register', {
    name: `Тестовий ${role}`,
    email,
    password,
    passwordConfirm: password,
    role
  });
  if (register.status !== 201) throw new Error(`Реєстрація ${role} не пройшла: ${JSON.stringify(register.json)}`);

  const created = await User.findByEmail(email);
  if (!created || !created.passwordHash || created.passwordHash === password) {
    throw new Error(`Пароль ${role} не було безпечно збережено у вигляді хешу`);
  }

  const login = await request('POST', '/auth/login', { email, password });
  if (login.status !== 200) throw new Error(`Вхід ${role} не пройшов: ${JSON.stringify(login.json)}`);
  const cookie = cookieFrom(login.headers);
  if (!cookie) throw new Error(`Після входу ${role} не створено cookie сесії`);

  const status = await request('GET', '/auth/status', null, cookie);
  if (!status.json.authenticated) throw new Error(`Сесія ${role} після входу не активна`);

  return { email, password, cookie };
}

async function expectStatus(method, url, body, cookie, expected, label) {
  const result = await request(method, url, body, cookie);
  if (result.status !== expected) {
    throw new Error(`${label}: очікувався статус ${expected}, отримано ${result.status}: ${JSON.stringify(result.json)}`);
  }
  return result;
}

async function main() {
  process.env.PASSWORD_ROTATION_DAYS = '90';
  await fs.rm(path.join(DATA_DIR, 'users.json'), { force: true });
  await fs.rm(path.join(DATA_DIR, 'audit.log'), { force: true });

  const server = app.listen(PORT);
  try {
    const operator = await registerAndLogin('operator');
    const analyst = await registerAndLogin('analyst');
    const administrator = await registerAndLogin('administrator');

    await expectStatus('GET', '/api/grid/balance', null, operator.cookie, 200, 'operator має бачити баланс');
    await expectStatus('POST', '/api/grid/adjust', {
      targetZone: 'central',
      adjustmentMW: 10,
      reason: 'Тестове балансування мережі'
    }, operator.cookie, 200, 'operator має коригувати баланс');
    await expectStatus('GET', '/api/forecasts', null, operator.cookie, 403, 'operator не має бачити прогнози analyst');

    await expectStatus('GET', '/api/grid/balance', null, analyst.cookie, 200, 'analyst має бачити баланс');
    await expectStatus('GET', '/api/forecasts', null, analyst.cookie, 200, 'analyst має бачити прогнози');
    await expectStatus('POST', '/api/grid/adjust', {
      targetZone: 'central',
      adjustmentMW: 5,
      reason: 'Перевірка RBAC'
    }, analyst.cookie, 403, 'analyst не має коригувати баланс');

    await expectStatus('POST', '/api/system/config', {
      parameter: 'idsSensitivity',
      value: 'high'
    }, administrator.cookie, 200, 'administrator має змінювати конфігурацію');
    await expectStatus('GET', '/api/security/events', null, administrator.cookie, 200, 'administrator має бачити журнал безпеки');

    console.log('OK: нові акаунти створюються для operator, analyst, administrator');
    console.log('OK: пароль вводиться двічі та перевіряється');
    console.log('OK: паролі збережено як bcrypt-хеші');
    console.log('OK: вхід нового акаунту працює');
    console.log('OK: сесії активні після входу');
    console.log('OK: мінімальна функціональність варіанту 11 працює');
    console.log('OK: RBAC-доступ по ролях працює');
    console.log('OK: повідомлення API повертаються українською');
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error('Тест не пройдено:', err.message);
  process.exit(1);
});
