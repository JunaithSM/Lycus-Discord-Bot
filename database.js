const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(__dirname, 'deadlines.json');

// Load config safely with defaults
let config = {
  defaultTimezone: 'Asia/Kolkata',
  defaultAlertTime: '09:00',
  defaultPingRole: 'everyone',
  defaultCustomText: '🚨 **{title}** is coming up! Remaining: {relative_timestamp}'
};

try {
  const userConfig = require('./config.json');
  config = { ...config, ...userConfig };
} catch (e) {
  // Use defaults
}

/**
 * Loads deadlines from the JSON file.
 * Returns an empty array if the file doesn't exist or is invalid.
 */
function loadDeadlines() {
  try {
    if (!fs.existsSync(FILE_PATH)) {
      return [];
    }
    const data = fs.readFileSync(FILE_PATH, 'utf8');
    return JSON.parse(data) || [];
  } catch (error) {
    console.error('Error reading database:', error);
    return [];
  }
}

/**
 * Saves deadlines to the JSON file using atomic writes.
 */
function saveDeadlines(deadlines) {
  const tempPath = `${FILE_PATH}.tmp`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(deadlines, null, 2), 'utf8');
    fs.renameSync(tempPath, FILE_PATH);
    return true;
  } catch (error) {
    console.error('Error writing database:', error);
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch (unlinkError) {
        console.error('Failed to clean up temp file:', unlinkError);
      }
    }
    return false;
  }
}

/**
 * Normalizes an ID string to be slug-friendly (lowercase, letters, numbers, hyphens).
 */
function normalizeId(id) {
  return id.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
}

/**
 * Adds a new deadline.
 */
function addDeadline(deadline) {
  const deadlines = loadDeadlines();
  const id = normalizeId(deadline.id);
  
  if (deadlines.some(d => d.id === id)) {
    throw new Error(`A deadline with ID "${id}" already exists.`);
  }

  const newDeadline = {
    id,
    title: deadline.title,
    targetDate: deadline.targetDate, // ISO string
    timezone: deadline.timezone || config.defaultTimezone,
    channelId: deadline.channelId,
    pingRole: deadline.pingRole || config.defaultPingRole,
    customText: deadline.customText || config.defaultCustomText,
    alertTime: deadline.alertTime || config.defaultAlertTime,
    updateType: deadline.updateType || 'edit', // 'edit' or 'create'
    lastAlertDate: '', // YYYY-MM-DD format of the last sent alert
    lastMessageId: '' // ID of the last sent countdown message
  };

  deadlines.push(newDeadline);
  saveDeadlines(deadlines);
  return newDeadline;
}

/**
 * Gets a deadline by its ID.
 */
function getDeadline(id) {
  const deadlines = loadDeadlines();
  const targetId = normalizeId(id);
  return deadlines.find(d => d.id === targetId);
}

/**
 * Updates an existing deadline.
 */
// Update function that takes normal id, handles normalization internally
function updateDeadline(id, updates) {
  const deadlines = loadDeadlines();
  const targetId = normalizeId(id);
  const index = deadlines.findIndex(d => d.id === targetId);

  if (index === -1) {
    throw new Error(`Deadline with ID "${id}" not found.`);
  }

  const updatedDeadline = {
    ...deadlines[index],
    ...updates,
    id: deadlines[index].id // ID cannot be updated directly
  };

  deadlines[index] = updatedDeadline;
  saveDeadlines(deadlines);
  return updatedDeadline;
}

/**
 * Deletes a deadline.
 */
function deleteDeadline(id) {
  const deadlines = loadDeadlines();
  const targetId = normalizeId(id);
  const index = deadlines.findIndex(d => d.id === targetId);

  if (index === -1) {
    throw new Error(`Deadline with ID "${id}" not found.`);
  }

  const deleted = deadlines.splice(index, 1)[0];
  saveDeadlines(deadlines);
  return deleted;
}

module.exports = {
  loadDeadlines,
  saveDeadlines,
  addDeadline,
  getDeadline,
  updateDeadline,
  deleteDeadline,
  normalizeId
};
