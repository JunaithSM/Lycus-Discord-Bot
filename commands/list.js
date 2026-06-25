const { EmbedBuilder } = require('discord.js');
const { DateTime } = require('luxon');
const db = require('../database');

/**
 * Handles `/deadline list` execution
 */
async function execute(interaction) {
  const deadlines = db.loadDeadlines();

  if (deadlines.length === 0) {
    return interaction.reply({
      content: 'ℹ️ There are currently no active deadlines scheduled.'
    });
  }

  const listEmbed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🗓️ Active Deadlines')
    .setDescription('Here is a list of all currently tracked deadlines:')
    .setFooter({ text: 'Antigravity Deadline Alert Bot' })
    .setTimestamp();

  deadlines.forEach(d => {
    const targetDate = DateTime.fromISO(d.targetDate, { zone: d.timezone });
    const timestamp = Math.floor(targetDate.toSeconds());
    
    let pingTarget = 'None';
    if (d.pingRole === 'everyone') pingTarget = '@everyone';
    else if (d.pingRole && d.pingRole !== 'none') pingTarget = `<@&${d.pingRole}>`;

    listEmbed.addFields({
      name: `📌 ${d.title} (ID: \`${d.id}\`)`,
      value: `• **Ends**: <t:${timestamp}:F> (<t:${timestamp}:R>)\n` +
             `• **Alert Channel**: <#${d.channelId}>\n` +
             `• **Daily Alert**: At \`${d.alertTime}\` (${d.timezone}) to ${pingTarget}`
    });
  });

  return interaction.reply({ embeds: [listEmbed] });
}

module.exports = { execute };
