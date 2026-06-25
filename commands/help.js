const { EmbedBuilder } = require('discord.js');

/**
 * Handles `/deadline help` execution
 */
async function execute(interaction) {
  const helpEmbed = new EmbedBuilder()
    .setColor(0x00FFFF)
    .setTitle('🚨 Discord Deadline Bot - Help Guide')
    .setDescription('Here is how to set up and manage customizable countdown alerts for your server.')
    .addFields(
      {
        name: '📋 Commands',
        value: 
          '• `/deadline add`: Schedule a new deadline.\n' +
          '• `/deadline list`: Show active deadlines and countdowns.\n' +
          '• `/deadline edit`: Modify an existing deadline (updates instantly!).\n' +
          '• `/deadline delete`: Stop and remove a deadline.'
      },
      {
        name: '✨ Custom Messages & Placeholders',
        value:
          'Customize your alerts using these variables in the `custom_text` parameter:\n' +
          '• `{title}`: Displays the title of the deadline.\n' +
          '• `{countdown}`: Human countdown (e.g. `2 days, 5 hours`).\n' +
          '• `{relative_timestamp}`: Discord dynamic countdown (`<t:TIMESTAMP:R>`).\n' +
          '• `{full_timestamp}`: Full date/time string (`<t:TIMESTAMP:F>`).'
      },
      {
        name: '⏱️ Daily Alert Frequency',
        value:
          'The bot alerts your target channel **once a day** at the configured `alert_time` (e.g. `09:00` in your chosen timezone). ' +
          'Instead of sending new messages, it **edits the same message** every day to keep the channel clean and uncluttered!'
      },
      {
        name: '🌍 Timezones',
        value:
          'Dates are parsed using the timezone you specify. Supported timezones include values like `Asia/Kolkata` (default for Chennai/India), `UTC`, `America/New_York`, etc.'
      }
    )
    .setFooter({ text: 'Antigravity Deadline Alert Bot' })
    .setTimestamp();

  return interaction.reply({ embeds: [helpEmbed] });
}

module.exports = { execute };
