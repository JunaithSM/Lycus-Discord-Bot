const { EmbedBuilder } = require('discord.js');
const { DateTime } = require('luxon');
const db = require('../database');
const { parseDateString, formatCountdown, getPingText } = require('../utils');

/**
 * Handles `/deadline edit` execution
 */
async function execute(interaction) {
  const { options, client } = interaction;
  const id = options.getString('id');
  const deadline = db.getDeadline(id);

  if (!deadline) {
    return interaction.reply({
      content: `❌ Deadline with ID \`${id}\` was not found.`,
      ephemeral: true
    });
  }

  const updates = {};
  const changesText = [];

  const title = options.getString('title');
  const rawDate = options.getString('date');
  const channel = options.getChannel('channel');
  const pingRole = options.getRole('ping_role');
  const disablePing = options.getBoolean('disable_ping');
  const alertTime = options.getString('alert_time');
  const customText = options.getString('custom_text');
  const tz = options.getString('timezone');
  const updateType = options.getString('update_type');

  // 1. Process timezone first (needed for date validation)
  if (tz) {
    if (!DateTime.now().setZone(tz).isValid) {
      return interaction.reply({
        content: `❌ Invalid timezone: \`${tz}\`.`,
        ephemeral: true
      });
    }
    updates.timezone = tz;
    changesText.push(`• **Timezone**: \`${tz}\``);
  }

  const activeTz = updates.timezone || deadline.timezone;

  // 2. Process date
  if (rawDate) {
    const parsedDate = parseDateString(rawDate, activeTz);
    if (!parsedDate) {
      return interaction.reply({
        content: `❌ Invalid date format: \`${rawDate}\`.`,
        ephemeral: true
      });
    }
    if (parsedDate <= DateTime.now().setZone(activeTz)) {
      return interaction.reply({
        content: `❌ Edited deadline must be in the future.`,
        ephemeral: true
      });
    }
    updates.targetDate = parsedDate.toISO();
    const ts = Math.floor(parsedDate.toSeconds());
    changesText.push(`• **Target Date**: <t:${ts}:F> (<t:${ts}:R>)`);
  }

  // 3. Process title
  if (title) {
    updates.title = title;
    changesText.push(`• **Title**: **${title}**`);
  }

  // 4. Process channel
  if (channel) {
    updates.channelId = channel.id;
    changesText.push(`• **Alert Channel**: <#${channel.id}>`);
  }

  // 5. Process ping role
  if (disablePing) {
    updates.pingRole = 'none';
    changesText.push('• **Ping Target**: *Disabled*');
  } else if (pingRole) {
    updates.pingRole = pingRole.id;
    changesText.push(`• **Ping Target**: <@&${pingRole.id}>`);
  }

  // 6. Process alert time
  if (alertTime) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(alertTime)) {
      return interaction.reply({
        content: `❌ Invalid daily alert time: \`${alertTime}\`. Format must be \`HH:MM\`.`,
        ephemeral: true
      });
    }
    updates.alertTime = alertTime;
    changesText.push(`• **Alert Time**: \`${alertTime}\``);
  }

  // 7. Process custom text
  if (customText) {
    updates.customText = customText;
    changesText.push(`• **Custom Text**: \`${customText}\``);
  }

  // 8. Process update type
  if (updateType) {
    updates.updateType = updateType;
    changesText.push(`• **Update Mode**: ${updateType === 'create' ? 'Create New Message' : 'Edit Message'}`);
  }

  // Verify if anything actually changed
  if (Object.keys(updates).length === 0) {
    return interaction.reply({
      content: 'ℹ️ No changes were specified.',
      ephemeral: true
    });
  }

  try {
    db.updateDeadline(id, updates);
    
    // Reset lastAlertDate if alertTime or date changed, so it gets re-checked immediately
    if (updates.alertTime || updates.targetDate || updates.timezone) {
      db.updateDeadline(id, { lastAlertDate: '' });
    }

    const updatedDeadline = db.getDeadline(id);
    
    // Update the existing alert message instantly if it exists
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
          console.log(`[Interaction] Failed to update message instantly on edit:`, err.message);
        }
      }
    }

    const editEmbed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('✏️ Deadline Updated')
      .setDescription(`Successfully updated deadline **${title || deadline.title}** (ID: \`${id}\`):\n\n${changesText.join('\n')}`)
      .setFooter({ text: 'Antigravity Deadline Alert Bot' })
      .setTimestamp();

    return interaction.reply({ embeds: [editEmbed] });
  } catch (err) {
    return interaction.reply({
      content: `❌ Error updating deadline: ${err.message}`,
      ephemeral: true
    });
  }
}

module.exports = { execute };
