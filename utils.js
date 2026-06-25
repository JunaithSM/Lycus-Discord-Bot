const { DateTime } = require('luxon');

/**
 * Parses user-provided date string in a specific timezone.
 */
function parseDateString(dateStr, tz) {
  const formats = [
    'yyyy-MM-dd HH:mm',
    'yyyy-MM-dd HH:mm:ss',
    'yyyy-MM-dd'
  ];

  for (const fmt of formats) {
    const dt = DateTime.fromFormat(dateStr, fmt, { zone: tz });
    if (dt.isValid) return dt;
  }

  const isoDt = DateTime.fromISO(dateStr, { zone: tz });
  if (isoDt.isValid) return isoDt;

  return null;
}

/**
 * Formats relative countdown duration to targetDate.
 */
function formatCountdown(targetDate, nowInTz) {
  const diff = targetDate.diff(nowInTz, ['days', 'hours', 'minutes']).toObject();
  const parts = [];
  
  const days = Math.floor(diff.days || 0);
  const hours = Math.floor(diff.hours || 0);
  const minutes = Math.floor(diff.minutes || 0);

  if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);

  return parts.join(', ') || 'less than a minute';
}

/**
 * Generates the role/everyone mention prefix string.
 */
function getPingText(pingRole, guildId) {
  if (!pingRole || pingRole === 'none') {
    return '';
  }
  if (pingRole === 'everyone' || pingRole === guildId) {
    return '@everyone ';
  }
  return `<@&${pingRole}> `;
}

module.exports = {
  parseDateString,
  formatCountdown,
  getPingText
};
