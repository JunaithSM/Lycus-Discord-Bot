require('dotenv').config();
const { Client, GatewayIntentBits, Events, ActivityType } = require('discord.js');
const db = require('./database');
const { deployCommands } = require('./deploy-commands');
const { startScheduler } = require('./scheduler');
const { startWebServer } = require('./web');

// Command handlers mapping
const commands = {
  add: require('./commands/add'),
  list: require('./commands/list'),
  delete: require('./commands/delete'),
  edit: require('./commands/edit'),
  help: require('./commands/help')
};

// Initialize the Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds
  ]
});

// Bot ready event
client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  
  // Set custom activity
  client.user.setActivity({
    name: 'deadlines...',
    type: ActivityType.Watching
  });

  // Deploy slash commands automatically on startup
  console.log('Registering slash commands...');
  const success = await deployCommands();
  if (success) {
    console.log('Slash commands registered successfully.');
  } else {
    console.warn('Failed to register slash commands during startup.');
  }

  // Start scheduler alert loop
  startScheduler(client);

  // Start Express Web Dashboard
  startWebServer(client);
});

// Interaction Handling (Slash commands and Autocomplete)
client.on(Events.InteractionCreate, async interaction => {
  // 1. Handle autocomplete requests for ID fields
  if (interaction.isAutocomplete()) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'delete' || subcommand === 'edit') {
      const focusedValue = interaction.options.getFocused().toLowerCase();
      const deadlines = db.loadDeadlines();
      
      const filtered = deadlines.filter(d => 
        d.id.includes(focusedValue) || d.title.toLowerCase().includes(focusedValue)
      );

      await interaction.respond(
        filtered.slice(0, 25).map(d => ({
          name: `${d.title} (${d.id})`,
          value: d.id
        }))
      ).catch(err => console.error('Autocomplete response failed:', err));
    }
    return;
  }

  // 2. Handle Chat Input Slash Commands
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options } = interaction;

  if (commandName === 'deadline') {
    const subcommand = options.getSubcommand();
    const handler = commands[subcommand];

    if (handler) {
      try {
        await handler.execute(interaction);
      } catch (err) {
        console.error(`Error executing subcommand ${subcommand}:`, err);
        const replyConfig = { content: '❌ An error occurred while executing this command.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(replyConfig);
        } else {
          await interaction.reply(replyConfig);
        }
      }
    } else {
      await interaction.reply({ content: `❌ Unknown subcommand: \`${subcommand}\``, ephemeral: true });
    }
  }
});

// Login using Token
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('Fatal Error: DISCORD_TOKEN environment variable is not defined.');
  process.exit(1);
}

client.login(token).catch(err => {
  console.error('Failed to login to Discord:', err);
  process.exit(1);
});
