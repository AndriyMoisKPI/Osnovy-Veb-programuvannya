const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

async function ensureStorage() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(USERS_FILE);
  } catch {
    await fs.writeFile(USERS_FILE, '[]', 'utf8');
  }
}

async function readUsers() {
  await ensureStorage();
  const raw = await fs.readFile(USERS_FILE, 'utf8');
  return JSON.parse(raw || '[]');
}

async function writeUsers(users) {
  await ensureStorage();
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

function publicUser(user) {
  if (!user) return null;
  const { passwordHash, failedLoginAttempts, ...safe } = user;
  return safe;
}

class User {
  static async findAll() {
    return readUsers();
  }

  static async findById(id) {
    const users = await readUsers();
    return users.find((user) => user.id === id) || null;
  }

  static async findByEmail(email) {
    const users = await readUsers();
    return users.find((user) => user.email === String(email).toLowerCase()) || null;
  }

  static async create({ name, email, passwordHash, role }) {
    const users = await readUsers();
    const normalizedEmail = String(email).toLowerCase();

    if (users.some((user) => user.email === normalizedEmail)) {
      const err = new Error('Користувач з таким email вже існує');
      err.status = 409;
      throw err;
    }

    const now = new Date().toISOString();
    const user = {
      id: crypto.randomUUID(),
      name,
      email: normalizedEmail,
      passwordHash,
      role,
      createdAt: now,
      passwordChangedAt: now,
      lastLoginAt: null,
      lastLoginIp: null,
      failedLoginAttempts: 0,
      lockedUntil: null
    };

    users.push(user);
    await writeUsers(users);
    return user;
  }

  static async update(id, patch) {
    const users = await readUsers();
    const index = users.findIndex((user) => user.id === id);
    if (index === -1) return null;
    users[index] = { ...users[index], ...patch };
    await writeUsers(users);
    return users[index];
  }

  static async incrementFailedLogin(email) {
    const user = await this.findByEmail(email);
    if (!user) return null;

    const failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    const patch = { failedLoginAttempts };

    if (failedLoginAttempts >= 5) {
      patch.lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    }

    return this.update(user.id, patch);
  }

  static async resetFailedLogins(id, ip) {
    return this.update(id, {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date().toISOString(),
      lastLoginIp: ip
    });
  }

  static toPublic(user) {
    return publicUser(user);
  }
}

module.exports = User;
