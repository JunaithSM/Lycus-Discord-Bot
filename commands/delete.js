const db = require('../database');

/**
 * Handles `/deadline delete` execution
 */
async function execute(interaction) {
  const id = interaction.options.getString('id');

  try {
    const deleted = db.deleteDeadline(id);
    return interaction.reply({
      content: `✅ Successfully deleted deadline **${deleted.title}** (ID: \`${deleted.id}\`).`
    });
  } catch (err) {
    return interaction.reply({
      content: `❌ Error: ${err.message}`,
      ephemeral: true
    });
  }
}

module.exports = { execute };
