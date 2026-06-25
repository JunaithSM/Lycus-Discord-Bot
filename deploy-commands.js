require('dotenv').config();
const { REST, Routes, SlashCommandBuilder, ChannelType } = require('discord.js');

// 1. Build the slash commands schema
const deadlineCommand = new SlashCommandBuilder()
  .setName('deadline')
  .setDescription('Manage deadline countdowns and alerts')
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription('Create a new deadline')
      .addStringOption(option =>
        option.setName('id')
          .setDescription('Unique lowercase identifier (e.g., project-1)')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('title')
          .setDescription('Display title of the deadline')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('date')
          .setDescription('Target date and time (e.g. YYYY-MM-DD HH:MM)')
          .setRequired(true))
      .addChannelOption(option =>
        option.setName('channel')
          .setDescription('Channel where daily alerts will be posted')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true))
      .addRoleOption(option =>
        option.setName('ping_role')
          .setDescription('Role to ping (default: @everyone)'))
      .addStringOption(option =>
        option.setName('alert_time')
          .setDescription('Daily alert time in HH:MM (default: 09:00)'))
      .addStringOption(option =>
        option.setName('custom_text')
          .setDescription('Custom text template (placeholders: {title}, {relative_timestamp}, {full_timestamp})'))
      .addStringOption(option =>
        option.setName('timezone')
          .setDescription('Timezone name (default: Asia/Kolkata)'))
      .addStringOption(option =>
        option.setName('update_type')
          .setDescription('Whether to edit the existing alert or create a new one each time (default: edit)')
          .addChoices(
            { name: 'Edit Message', value: 'edit' },
            { name: 'Create New Message', value: 'create' }
          ))
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('List all active deadlines')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('delete')
      .setDescription('Delete an existing deadline')
      .addStringOption(option =>
        option.setName('id')
          .setDescription('ID of the deadline to delete')
          .setRequired(true)
          .setAutocomplete(true))
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('edit')
      .setDescription('Modify an existing deadline')
      .addStringOption(option =>
        option.setName('id')
          .setDescription('ID of the deadline to edit')
          .setRequired(true)
          .setAutocomplete(true))
      .addStringOption(option =>
        option.setName('title')
          .setDescription('New display title'))
      .addStringOption(option =>
        option.setName('date')
          .setDescription('New target date and time (e.g. YYYY-MM-DD HH:MM)'))
      .addChannelOption(option =>
        option.setName('channel')
          .setDescription('New channel for alerts')
          .addChannelTypes(ChannelType.GuildText))
      .addRoleOption(option =>
        option.setName('ping_role')
          .setDescription('New role to ping (or set to none)'))
      .addStringOption(option =>
        option.setName('alert_time')
          .setDescription('New daily alert time in HH:MM'))
      .addStringOption(option =>
        option.setName('custom_text')
          .setDescription('New custom text template'))
      .addStringOption(option =>
        option.setName('timezone')
          .setDescription('New timezone name'))
      .addStringOption(option =>
        option.setName('update_type')
          .setDescription('New update type preference: edit existing or create new message')
          .addChoices(
            { name: 'Edit Message', value: 'edit' },
            { name: 'Create New Message', value: 'create' }
          ))
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('help')
      .setDescription('Show instructions and options for the deadline bot')
  );

const commands = [deadlineCommand.toJSON()];

/**
 * Extracts Client ID from Discord Token
 */
function getClientIdFromToken(token) {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length > 0) {
      const clientId = Buffer.from(parts[0], 'base64').toString('utf8');
      if (/^\d+$/.test(clientId)) {
        return clientId;
      }
    }
  } catch (err) {
    console.error('Failed to parse client ID from token:', err);
  }
  return null;
}

/**
 * Deploys the commands to Discord API
 */
async function deployCommands() {
  const token = process.env.DISCORD_TOKEN;
  const guildId = process.env.GUILD_ID;
  const clientId = process.env.CLIENT_ID || getClientIdFromToken(token);

  if (!token) {
    console.error('Error: DISCORD_TOKEN is missing in environment variables.');
    return false;
  }

  if (!clientId) {
    console.error('Error: CLIENT_ID could not be determined. Please set it in .env');
    return false;
  }

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    if (guildId) {
      console.log(`Started refreshing ${commands.length} application (/) commands for Guild ${guildId}...`);
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands }
      );
      console.log('Successfully reloaded application (/) commands for guild.');
    } else {
      console.log(`Started refreshing ${commands.length} global application (/) commands...`);
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands }
      );
      console.log('Successfully reloaded global application (/) commands.');
    }
    return true;
  } catch (error) {
    console.error('Error registering slash commands:', error);
    return false;
  }
}

// Execute if run directly
if (require.main === module) {
  deployCommands();
}

module.exports = {
  deployCommands,
  commands
};
