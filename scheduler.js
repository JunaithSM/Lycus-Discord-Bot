const { DateTime } = require('luxon');
const db = require('./database');
const { formatCountdown, getPingText } = require('./utils');

// Load config safely with defaults
let config = {
  schedulerIntervalMs: 60000
};

try {
  const userConfig = require('./config.json');
  config = { ...config, ...userConfig };
} catch (e) {
  // Use defaults
}

/**
 * Iterates through all active deadlines, pings, or edits countdown posts.
 */
async function checkDeadlines(client) {
  const deadlines = db.loadDeadlines();
  if (deadlines.length === 0) return;

  const now = DateTime.now();

  for (const deadline of deadlines) {
    try {
      const tz = deadline.timezone || 'Asia/Kolkata';
      const targetDate = DateTime.fromISO(deadline.targetDate, { zone: tz });
      const nowInTz = now.setZone(tz);

      // 1. Check if deadline has been reached
      if (nowInTz >= targetDate) {
        console.log(`[Scheduler] Deadline reached: ${deadline.title} (${deadline.id})`);
        
        const channel = client.channels.cache.get(deadline.channelId) || 
                        await client.channels.fetch(deadline.channelId).catch(() => null);
        
        if (channel) {
          const pingText = getPingText(deadline.pingRole, channel.guild.id);
          const finalContent = `${pingText}🎉 **${deadline.title}** has reached its deadline!`;
          
          let messageEdited = false;
          if (deadline.updateType !== 'create' && deadline.lastMessageId) {
            try {
              const existingMsg = await channel.messages.fetch(deadline.lastMessageId);
              if (existingMsg) {
                await existingMsg.edit({ content: finalContent });
                messageEdited = true;
              }
            } catch (err) {
              console.log(`[Scheduler] Failed to edit final message for ${deadline.id}:`, err.message);
            }
          }
          
          if (!messageEdited) {
            await channel.send({ content: finalContent }).catch(err => console.error(`Failed to send final alert for ${deadline.id}:`, err));
          }
        }

        // Delete the deadline
        db.deleteDeadline(deadline.id);
        continue;
      }

      // 2. Check if we should send/edit the daily alert
      const todayStr = nowInTz.toFormat('yyyy-MM-dd');
      if (deadline.lastAlertDate !== todayStr) {
        const [alertHour, alertMin] = deadline.alertTime.split(':').map(Number);
        const alertTimeToday = nowInTz.set({ hour: alertHour, minute: alertMin, second: 0, millisecond: 0 });

        if (nowInTz >= alertTimeToday) {
          console.log(`[Scheduler] Triggering daily alert/edit for: ${deadline.title} (${deadline.id})`);

          const channel = client.channels.cache.get(deadline.channelId) || 
                          await client.channels.fetch(deadline.channelId).catch(() => null);

          if (channel) {
            const countdownStr = formatCountdown(targetDate, nowInTz);
            const unixTimestamp = Math.floor(targetDate.toSeconds());

            // Interpolate variables into custom text template
            let msg = deadline.customText;
            msg = msg.replace(/{title}/g, deadline.title);
            msg = msg.replace(/{countdown}/g, countdownStr);
            msg = msg.replace(/{relative_timestamp}/g, `<t:${unixTimestamp}:R>`);
            msg = msg.replace(/{full_timestamp}/g, `<t:${unixTimestamp}:F>`);

            const pingText = getPingText(deadline.pingRole, channel.guild.id);
            const content = `${pingText}${msg}`;

            let alertMessage = null;
            if (deadline.updateType !== 'create' && deadline.lastMessageId) {
              try {
                const existingMsg = await channel.messages.fetch(deadline.lastMessageId);
                if (existingMsg) {
                  alertMessage = await existingMsg.edit({ content });
                  console.log(`[Scheduler] Successfully edited alert message for ${deadline.id}`);
                }
              } catch (err) {
                console.log(`[Scheduler] Failed to edit existing alert message for ${deadline.id}, sending a new one:`, err.message);
              }
            }

            if (!alertMessage) {
              alertMessage = await channel.send({ content }).catch(err => console.error(`Failed to send daily alert for ${deadline.id}:`, err));
            }

            // Update database with today's date and the sent message ID
            const dbUpdates = { lastAlertDate: todayStr };
            if (alertMessage) {
              dbUpdates.lastMessageId = alertMessage.id;
            }
            db.updateDeadline(deadline.id, dbUpdates);
          }
        }
      }
    } catch (err) {
      console.error(`[Scheduler] Error checking deadline ${deadline?.id}:`, err);
    }
  }
}

/**
 * Starts the periodic tick scheduler.
 */
function startScheduler(client) {
  console.log(`[Scheduler] Starting alert loop (every ${Math.round(config.schedulerIntervalMs / 1000)} seconds)...`);
  checkDeadlines(client); // Run once immediately
  setInterval(() => checkDeadlines(client), config.schedulerIntervalMs);
}

module.exports = {
  startScheduler,
  checkDeadlines
};
