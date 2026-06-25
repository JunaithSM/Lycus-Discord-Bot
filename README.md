# Discord Deadline Alert Bot 🚨

A customizable Discord bot built with **Node.js** and **discord.js** (v14) to schedule deadlines, compute live countdowns, and ping roles/channels daily until completion.

## Features

- **Slash Commands**: Manage everything natively within Discord (`/deadline add`, `/deadline list`, `/deadline edit`, `/deadline delete`).
- **Timezone Support**: Set dates and times under any timezone (defaults to **Asia/Kolkata** for India/Chennai).
- **Interactive Autocomplete**: Easy search for deadline IDs when deleting or editing.
- **Custom Countdown Messages**: Customize messages using template tokens:
  - `{title}`: The title of the deadline.
  - `{countdown}`: Human-readable countdown (e.g. `2 days, 5 hours`).
  - `{relative_timestamp}`: Discord relative countdown tag (dynamically updates inside Discord).
  - `{full_timestamp}`: Full date and time representation.
- **Web Dashboard UI**: A minimal, low-contrast, modern grayscale web panel to manage, add, edit, and delete deadlines easily in a browser without commands.
- **Clean Channels**: Tracks and edits the same alert message daily instead of posting new ones. Updates are applied instantly when modifying a deadline using `/deadline edit` or the web panel.
- **Robust Persistence**: Save scheduler state atomically to `deadlines.json` to prevent data loss.

---

## Setup & Running

### 1. Configure Credentials & Settings
- **Token**: Add your Discord Bot Token to the `.env` file in the root directory:
  ```env
  DISCORD_TOKEN="YOUR_BOT_TOKEN_HERE"
  ```
  *(Optional: Define `GUILD_ID` in `.env` if you want slash commands to register instantly in a specific server for development).*

- **Defaults**: Customize the default settings in the [config.json](file:///home/junaith/Programs/Github/Lycus%20Studios/Discord%20bot%20Lycus/config.json) file:
  ```json
  {
    "defaultTimezone": "Asia/Kolkata",
    "defaultAlertTime": "09:00",
    "defaultPingRole": "everyone",
    "defaultCustomText": "🚨 **{title}** is coming up! Remaining: {relative_timestamp}",
    "schedulerIntervalMs": 60000,
    "dashboardPort": 3000
  }
  ```
  - `defaultTimezone`: Default IANA timezone name.
  - `defaultAlertTime`: Daily alert time to ping (24h format `HH:MM`).
  - `defaultPingRole`: Role to ping (e.g. `everyone`, `none`, or a role ID).
  - `defaultCustomText`: The markdown alert structure.
  - `schedulerIntervalMs`: Frequency (in milliseconds) the bot checks deadlines.
  - `dashboardPort`: The local port the web dashboard runs on (defaults to `3000`).

### 2. Install Dependencies
```bash
npm install
```

### 3. Run the Bot
```bash
node index.js
```
On startup, the bot will automatically register the `/deadline` command globally or to your specified guild.

---

## Slash Commands usage

### `/deadline add`
Add a new deadline.
- `id` (Required): A short, unique identifier (e.g. `final-exam`).
- `title` (Required): Display name of the deadline (e.g. `Final Exam`).
- `date` (Required): Target date/time (e.g., `2026-06-30 09:00` or `2026-06-30`).
- `channel` (Required): Text channel for countdowns and notifications.
- `ping_role` (Optional): Role to mention (defaults to `@everyone`).
- `alert_time` (Optional): Daily time to ping the channel (format: `HH:MM`, defaults to `09:00`).
- `custom_text` (Optional): Custom message template (e.g. `🚨 **{title}** is due! {relative_timestamp}`).
- `timezone` (Optional): Timezone name (defaults to `Asia/Kolkata`).

### `/deadline list`
Lists all active deadlines, including active countdowns, target channels, and schedule details.

### `/deadline edit`
Modify an existing deadline.
- `id` (Required): The identifier of the deadline to edit (with autocomplete support).
- Supports editing `title`, `date`, `channel`, `ping_role`, `alert_time`, `custom_text`, `timezone`.
- To completely disable daily alerts pings, set the `disable_ping` parameter to `True`.

### `/deadline delete`
Delete a deadline using autocomplete selection.
- `id` (Required): Identifier of the deadline to delete.

### `/deadline help`
Displays the built-in help guide, detailing subcommands, layout placeholders, daily pings, and timezone inputs.
