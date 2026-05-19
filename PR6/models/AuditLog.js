const fs = require('fs/promises');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const LOG_FILE = path.join(DATA_DIR, 'audit.log');

async function writeEvent(type, details = {}) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const event = {
    time: new Date().toISOString(),
    type,
    ...details
  };
  await fs.appendFile(LOG_FILE, `${JSON.stringify(event)}\n`, 'utf8');
  console.log(`[SECURITY] ${event.time} ${type}`, details);
  return event;
}

async function readEvents(limit = 100) {
  try {
    const raw = await fs.readFile(LOG_FILE, 'utf8');
    return raw
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .slice(-limit)
      .reverse();
  } catch {
    return [];
  }
}

module.exports = { writeEvent, readEvents };
