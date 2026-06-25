const express = require('express');
const path = require('path');
const { DateTime } = require('luxon');
const db = require('./database');
const { parseDateString, formatCountdown, getPingText } = require('./utils');

// Load config safely with defaults
let config = {
  dashboardPort: 3000,
  defaultTimezone: 'Asia/Kolkata',
  defaultAlertTime: '09:00',
  defaultPingRole: 'everyone',
  defaultCustomText: '🚨 **{title}** is coming up! Remaining: {relative_timestamp}'
};

try {
  const userConfig = require('./config.json');
  config = { ...config, ...userConfig };
} catch (e) {}

/**
 * Initializes and starts the Express web server serving the dashboard
 * and the REST API.
 */
function startWebServer(client) {
  const app = express();
  const port = process.env.PORT || config.dashboardPort || 3000;

  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'dashboard', 'public')));

  // REST API: Get configuration defaults
  app.get('/api/config', (req, res) => {
    res.json({
      defaultTimezone: config.defaultTimezone,
      defaultAlertTime: config.defaultAlertTime,
      defaultPingRole: config.defaultPingRole,
      defaultCustomText: config.defaultCustomText
    });
  });

  // REST API: Get all deadlines
  app.get('/api/deadlines', (req, res) => {
    res.json(db.loadDeadlines());
  });

  // REST API: Get available channels
  app.get('/api/channels', (req, res) => {
    const channels = [];
    client.guilds.cache.forEach(guild => {
      guild.channels.cache.forEach(channel => {
        if (channel.type === 0) { // GuildText
          channels.push({
            id: channel.id,
            name: channel.name,
            guildName: guild.name
          });
        }
      });
    });
    res.json(channels);
  });

  // REST API: Get available roles
  app.get('/api/roles', (req, res) => {
    const roles = [];
    client.guilds.cache.forEach(guild => {
      guild.roles.cache.forEach(role => {
        roles.push({
          id: role.id,
          name: role.name,
          guildName: guild.name
        });
      });
    });
    res.json(roles);
  });

  // REST API: Create a new deadline
  app.post('/api/deadlines', (req, res) => {
    const { id, title, date, channelId, pingRole, alertTime, customText, timezone } = req.body;

    if (!id || !title || !date || !channelId) {
      return res.status(400).json({ error: 'Missing required fields: id, title, date, channelId' });
    }

    const normalizedId = db.normalizeId(id);
    const tz = timezone || config.defaultTimezone;

    // Validate Timezone
    if (!DateTime.now().setZone(tz).isValid) {
      return res.status(400).json({ error: `Invalid timezone: ${tz}` });
    }

    // Validate Date
    const parsedDate = parseDateString(date, tz);
    if (!parsedDate) {
      return res.status(400).json({ error: `Invalid date format: ${date}` });
    }
    if (parsedDate <= DateTime.now().setZone(tz)) {
      return res.status(400).json({ error: 'Deadline date must be in the future.' });
    }

    // Validate alertTime
    const alertTimeVal = alertTime || config.defaultAlertTime;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(alertTimeVal)) {
      return res.status(400).json({ error: 'Alert time must be in HH:MM format.' });
    }

    try {
      const newDeadline = db.addDeadline({
        id: normalizedId,
        title,
        targetDate: parsedDate.toISO(),
        timezone: tz,
        channelId,
        pingRole: pingRole || config.defaultPingRole,
        customText: customText || config.defaultCustomText,
        alertTime: alertTimeVal
      });
      res.status(201).json(newDeadline);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // REST API: Update a deadline
  app.put('/api/deadlines/:id', async (req, res) => {
    const { id } = req.params;
    const body = req.body;

    const deadline = db.getDeadline(id);
    if (!deadline) {
      return res.status(404).json({ error: 'Deadline not found.' });
    }

    const updates = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.channelId !== undefined) updates.channelId = body.channelId;
    if (body.pingRole !== undefined) updates.pingRole = body.pingRole;
    if (body.customText !== undefined) updates.customText = body.customText;

    if (body.timezone !== undefined) {
      if (!DateTime.now().setZone(body.timezone).isValid) {
        return res.status(400).json({ error: `Invalid timezone: ${body.timezone}` });
      }
      updates.timezone = body.timezone;
    }

    const activeTz = updates.timezone || deadline.timezone;

    if (body.date !== undefined) {
      const parsedDate = parseDateString(body.date, activeTz);
      if (!parsedDate) {
        return res.status(400).json({ error: `Invalid date format: ${body.date}` });
      }
      const isoDate = parsedDate.toISO();
      if (isoDate !== deadline.targetDate) {
        if (parsedDate <= DateTime.now().setZone(activeTz)) {
          return res.status(400).json({ error: 'Deadline must be in the future.' });
        }
        updates.targetDate = isoDate;
      }
    }

    if (body.alertTime !== undefined) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.alertTime)) {
        return res.status(400).json({ error: 'Alert time must be in HH:MM format.' });
      }
      updates.alertTime = body.alertTime;
    }

    try {
      db.updateDeadline(id, updates);

      // Reset lastAlertDate if timing changed
      if (updates.alertTime || updates.targetDate || updates.timezone) {
        db.updateDeadline(id, { lastAlertDate: '' });
      }

      const updatedDeadline = db.getDeadline(id);

      // Instantly edit message in Discord if it exists
      if (updatedDeadline.lastMessageId) {
        const alertChannel = client.channels.cache.get(updatedDeadline.channelId) || 
                             await client.channels.fetch(updatedDeadline.channelId).catch(() => null);
        if (alertChannel) {
          try {
            const existingMsg = await alertChannel.messages.fetch(updatedDeadline.lastMessageId);
            if (existingMsg) {
              const dtTz = updatedDeadline.timezone || 'Asia/Kolkata';
              const targetDate = DateTime.fromISO(updatedDeadline.targetDate, { zone: dtTz });
              const nowInTz = DateTime.now().setZone(dtTz);
              
              const countdownStr = formatCountdown(targetDate, nowInTz);
              const unixTimestamp = Math.floor(targetDate.toSeconds());

              let msg = updatedDeadline.customText;
              msg = msg.replace(/{title}/g, updatedDeadline.title);
              msg = msg.replace(/{countdown}/g, countdownStr);
              msg = msg.replace(/{relative_timestamp}/g, `<t:${unixTimestamp}:R>`);
              msg = msg.replace(/{full_timestamp}/g, `<t:${unixTimestamp}:F>`);

              const pingText = getPingText(updatedDeadline.pingRole, alertChannel.guild.id);
              const content = `${pingText}${msg}`;
              
              await existingMsg.edit({ content });
            }
          } catch (err) {
            console.log(`[Dashboard API] Failed to update message instantly on edit:`, err.message);
          }
        }
      }

      res.json(updatedDeadline);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // REST API: Delete a deadline
  app.delete('/api/deadlines/:id', (req, res) => {
    const { id } = req.params;
    try {
      const deleted = db.deleteDeadline(id);
      res.json(deleted);
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  app.listen(port, () => {
    console.log(`[Web Dashboard] Server running on http://localhost:${port}`);
  });
}

module.exports = { startWebServer };
