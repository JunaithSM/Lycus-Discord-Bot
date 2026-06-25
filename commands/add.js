const { EmbedBuilder } = require('discord.js');
const { DateTime } = require('luxon');
const db = require('../database');
const { parseDateString } = require('../utils');

// Load config safely with defaults
let config = {
  defaultTimezone: 'Asia/Kolkata',
  defaultAlertTime: '09:00'
};
try {
  const userConfig = require('../config.json');
  config = { ...config, ...userConfig };
} catch (e) {}

/**
 * Handles `/deadline add` execution
 */
async function execute(interaction) {
  const { options } = interaction;
  const rawId = options.getString('id');
  const title = options.getString('title');
  const rawDate = options.getString('date');
  const channel = options.getChannel('channel');
  const pingRole = options.getRole('ping_role');
  const alertTime = options.getString('alert_time') || config.defaultAlertTime;
  const customText = options.getString('custom_text');
  const tz = options.getString('timezone') || config.defaultTimezone;
  const updateType = options.getString('update_type') || 'edit';

  const id = db.normalizeId(rawId);

  // Validate Timezone
  if (!DateTime.now().setZone(tz).isValid) {
    return interaction.reply({
      content: `❌ Invalid timezone: \`${tz}\`. Please use a valid IANA timezone (e.g., \`Asia/Kolkata\`, \`UTC\`, \`America/New_York\`).`,
      ephemeral: true
    });
  }

  // Validate Date Input
  const parsedDate = parseDateString(rawDate, tz);
  if (!parsedDate) {
    return interaction.reply({
      content: `❌ Invalid date format: \`${rawDate}\`. Please use one of the following:\n` +
               `• \`YYYY-MM-DD HH:MM\` (e.g., \`2026-06-30 18:30\`)\n` +
               `• \`YYYY-MM-DD\` (e.g., \`2026-06-30\`)\n` +
               `• ISO 8601 (e.g., \`2026-06-30T18:30:00+05:30\`)`,
      ephemeral: true
    });
  }

  // Ensure Date is in the future
  if (parsedDate <= DateTime.now().setZone(tz)) {
    return interaction.reply({
      content: `❌ The deadline must be in the future. Input parsed as: <t:${Math.floor(parsedDate.toSeconds())}:F>`,
      ephemeral: true
    });
  }

  // Validate alert_time HH:MM
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(alertTime)) {
    return interaction.reply({
      content: `❌ Invalid daily alert time: \`${alertTime}\`. Format must be \`HH:MM\` (24-hour format, e.g. \`09:00\` or \`21:30\`).`,
      ephemeral: true
    });
  }

  try {
    const pingRoleId = pingRole ? pingRole.id : 'everyone';
    
    const newDeadline = db.addDeadline({
      id,
      title,
      targetDate: parsedDate.toISO(),
      timezone: tz,
      channelId: channel.id,
      pingRole: pingRoleId,
      customText,
      alertTime,
      updateType
    });

    const targetTimestamp = Math.floor(parsedDate.toSeconds());
    const responseEmbed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ Deadline Scheduled')
      .setDescription(`Successfully created deadline **${newDeadline.title}**!`)
      .addFields(
        { name: 'ID (for modifications)', value: `\`${newDeadline.id}\``, inline: true },
        { name: 'Target Date', value: `<t:${targetTimestamp}:F> (<t:${targetTimestamp}:R>)`, inline: true },
        { name: 'Target Channel', value: `<#${newDeadline.channelId}>`, inline: true },
        { name: 'Daily Alert Time', value: `\`${newDeadline.alertTime}\` (${newDeadline.timezone})`, inline: true },
        { name: 'Ping Target', value: newDeadline.pingRole === 'everyone' ? '@everyone' : `<@&${newDeadline.pingRole}>`, inline: true },
        { name: 'Update Mode', value: newDeadline.updateType === 'create' ? 'Create New Message' : 'Edit Message', inline: true }
      )
      .setFooter({ text: 'Antigravity Deadline Alert Bot' })
      .setTimestamp();

    return interaction.reply({ embeds: [responseEmbed] });
  } catch (err) {
    return interaction.reply({
      content: `❌ Error creating deadline: ${err.message}`,
      ephemeral: true
    });
  }
}

module.exports = { execute };
