// State Management
let deadlines = [];
let channels = [];
let roles = [];
let defaults = {};

// Elements
const deadlinesList = document.getElementById('deadlines-list');
const formPanel = document.getElementById('form-panel-container');
const panelTitleText = document.getElementById('panel-title-text');
const btnShowAddPanel = document.getElementById('btn-show-add-panel');
const btnClosePanel = document.getElementById('btn-close-panel');
const btnCancelForm = document.getElementById('btn-cancel-form');
const deadlineForm = document.getElementById('deadline-form');

const formAction = document.getElementById('form-action');
const originalIdInput = document.getElementById('deadline-original-id');
const idInput = document.getElementById('input-id');
const titleInput = document.getElementById('input-title');
const dateInput = document.getElementById('input-date');
const selectChannel = document.getElementById('select-channel');
const selectRole = document.getElementById('select-role');
const alertTimeInput = document.getElementById('input-alert-time');
const timezoneInput = document.getElementById('select-timezone');
const customTextInput = document.getElementById('textarea-custom-text');
const selectUpdateType = document.getElementById('select-update-type');

// Navigation Tabs Elements
const navDashboard = document.getElementById('nav-dashboard');
const navDocs = document.getElementById('nav-docs');
const tabDashboard = document.getElementById('tab-dashboard');
const tabDocs = document.getElementById('tab-docs');

// Stats Elements
const statTotal = document.getElementById('stat-total');

// Helper: Show Toast Notification
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <span class="toast-icon">
      <svg class="icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    </span>
    <span>${message}</span>
  `;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Helper: Format Countdown for browser display
function getCountdownText(targetDateISO) {
  const target = new Date(targetDateISO).getTime();
  const now = new Date().getTime();
  const diff = target - now;

  if (diff <= 0) {
    return 'Passed';
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  
  // Show seconds if less than a day remaining to make it feel responsive
  if (days === 0) {
    parts.push(`${seconds}s`);
  }

  return parts.join(' ') || '0s';
}

// Format ISO string to user-friendly readable local string
function formatLocalDate(isoString) {
  try {
    const d = new Date(isoString);
    return d.toLocaleString();
  } catch (e) {
    return isoString;
  }
}

// Fetch Channels & Roles dropdown lists
async function fetchDiscordData() {
  try {
    const [chanRes, roleRes, configRes] = await Promise.all([
      fetch('/api/channels'),
      fetch('/api/roles'),
      fetch('/api/config')
    ]);

    channels = await chanRes.json();
    roles = await roleRes.json();
    defaults = await configRes.json();

    populateDropdowns();
  } catch (err) {
    console.error('Failed to load Discord context data:', err);
  }
}

function populateDropdowns() {
  // Channels Select
  selectChannel.innerHTML = '<option value="" disabled selected>Select channel...</option>';
  channels.forEach(ch => {
    const opt = document.createElement('option');
    opt.value = ch.id;
    opt.textContent = `#${ch.name} (${ch.guildName})`;
    selectChannel.appendChild(opt);
  });

  // Roles Select
  selectRole.innerHTML = '';
  // Add @everyone option
  const optEveryone = document.createElement('option');
  optEveryone.value = 'everyone';
  optEveryone.textContent = '@everyone';
  selectRole.appendChild(optEveryone);

  // Add None option
  const optNone = document.createElement('option');
  optNone.value = 'none';
  optNone.textContent = 'None (No Ping)';
  selectRole.appendChild(optNone);

  roles.forEach(role => {
    // Avoid double adding everyone/here
    if (role.name !== '@everyone' && role.name !== '@here') {
      const opt = document.createElement('option');
      opt.value = role.id;
      opt.textContent = `${role.name} (${role.guildName})`;
      selectRole.appendChild(opt);
    }
  });
}

// Fetch Deadlines list
async function fetchDeadlines() {
  try {
    const res = await fetch('/api/deadlines');
    deadlines = await res.json();
    renderDeadlines();
    updateStats();
  } catch (err) {
    console.error('Error fetching deadlines:', err);
  }
}

// Render Deadlines cards
function renderDeadlines() {
  if (deadlines.length === 0) {
    deadlinesList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">
          <svg class="icon" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </span>
        <p class="empty-text">No active deadlines scheduled.</p>
        <p class="empty-subtext">Click "New Deadline" to schedule one.</p>
      </div>
    `;
    return;
  }

  deadlinesList.innerHTML = '';
  deadlines.forEach(d => {
    const card = document.createElement('div');
    card.className = 'deadline-card';
    card.dataset.id = d.id;

    const channelName = channels.find(c => c.id === d.channelId)?.name || d.channelId;
    let pingName = 'None';
    if (d.pingRole === 'everyone') pingName = '@everyone';
    else if (d.pingRole !== 'none') {
      pingName = roles.find(r => r.id === d.pingRole)?.name || d.pingRole;
    }

    card.innerHTML = `
      <div class="deadline-header">
        <div class="deadline-title-slug">
          <span class="deadline-card-title">${d.title}</span>
          <span class="deadline-card-id">ID: ${d.id}</span>
        </div>
      </div>
      <div class="deadline-countdown-block">
        <div class="countdown-time" data-target="${d.targetDate}">${getCountdownText(d.targetDate)}</div>
        <div class="countdown-label">Time Remaining</div>
      </div>
      <div class="deadline-details">
        <div class="detail-item">
          <span class="detail-label">Ends</span>
          <span class="detail-value" title="${d.targetDate}">${formatLocalDate(d.targetDate)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Channel</span>
          <span class="detail-value">#${channelName}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Daily Ping</span>
          <span class="detail-value">${d.alertTime} (${pingName})</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Timezone</span>
          <span class="detail-value">${d.timezone}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Alert Mode</span>
          <span class="detail-value">${d.updateType === 'create' ? 'New Message' : 'Edit Message'}</span>
        </div>
      </div>
      <div class="card-actions">
        <button class="btn btn-secondary btn-edit" data-id="${d.id}">Edit</button>
        <button class="btn btn-secondary btn-delete" data-id="${d.id}">Delete</button>
      </div>
    `;

    deadlinesList.appendChild(card);
  });

  // Attach card event listeners
  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      openEditPanel(e.target.dataset.id);
    });
  });

  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      deleteDeadline(e.target.dataset.id);
    });
  });
}

// Update stats dashboard overview cards
function updateStats() {
  statTotal.textContent = deadlines.length;
}

// Escape HTML characters to prevent XSS/raw tags injection in message preview
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Simple Discord markdown rendering
function renderDiscordMarkdown(text) {
  let rendered = escapeHtml(text);

  // Bold (**bold**)
  rendered = rendered.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Italic (*italic* or _italic_)
  rendered = rendered.replace(/\*(.*?)\*/g, '<em>$1</em>');
  rendered = rendered.replace(/_(.*?)_/g, '<em>$1</em>');
  
  // Underline (__underline__)
  rendered = rendered.replace(/__(.*?)__/g, '<u>$1</u>');
  
  // Strikethrough (~~strikethrough~~)
  rendered = rendered.replace(/~~(.*?)~~/g, '<s>$1</s>');
  
  // Inline Code (`code`)
  rendered = rendered.replace(/`(.*?)`/g, '<code class="discord-inline-code">$1</code>');

  return rendered;
}

// Generate the dynamic real-time Discord preview message
function updateDiscordPreview() {
  const title = titleInput.value.trim() || '[Display Title]';
  const customMsg = customTextInput.value.trim() || defaults.defaultCustomText || '🚨 **{title}** is coming up! Remaining: {relative_timestamp}';
  const targetDateStr = dateInput.value;
  const pingRole = selectRole.value;

  // 1. Resolve ping mentions formatting
  let pingPrefix = '';
  if (pingRole === 'everyone') {
    pingPrefix = '<span class="discord-mention">@everyone</span> ';
  } else if (pingRole !== 'none') {
    const roleName = roles.find(r => r.id === pingRole)?.name || 'role';
    pingPrefix = `<span class="discord-mention">@${roleName}</span> `;
  }

  // 2. Generate simulated countdown and relative/full timestamps
  const clockSvg = `<svg class="preview-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px; margin-top:-2px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
  const calendarSvg = `<svg class="preview-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px; margin-top:-2px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;

  let countdownText = '2 days, 4 hours, 15 minutes';
  let relativeTimeStr = `<span class="discord-mention">${clockSvg}in 2 days</span>`;
  let fullTimeStr = `<span class="discord-mention">${calendarSvg}Thursday, June 25, 2026 6:30 PM</span>`;

  if (targetDateStr) {
    try {
      const targetTime = new Date(targetDateStr).getTime();
      const nowTime = new Date().getTime();
      const diff = targetTime - nowTime;

      if (diff <= 0) {
        countdownText = 'passed';
        relativeTimeStr = `<span class="discord-mention">${clockSvg}passed</span>`;
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        const parts = [];
        if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
        if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
        if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
        countdownText = parts.join(', ') || 'less than a minute';

        const daysText = days > 0 ? `${days}d ` : '';
        const hoursText = hours > 0 ? `${hours}h ` : '';
        relativeTimeStr = `<span class="discord-mention">${clockSvg}in ${daysText}${hoursText}</span>`;
      }

      const targetDateObj = new Date(targetDateStr);
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
      fullTimeStr = `<span class="discord-mention">${calendarSvg}${targetDateObj.toLocaleDateString([], options)}</span>`;
    } catch (e) {}
  }

  // 3. Process placeholders (using markers to prevent HTML escaping)
  let processedMsg = customMsg
    .replace(/{title}/g, title)
    .replace(/{countdown}/g, countdownText)
    .replace(/{relative_timestamp}/g, 'RELATIVETIMEPREVIEW')
    .replace(/{full_timestamp}/g, 'FULLTIMEPREVIEW');

  // 4. Render markdown styling (which escapes other HTML characters)
  let bodyHtml = renderDiscordMarkdown(processedMsg);

  // 5. Swap markers back with the styled HTML timestamp pills
  bodyHtml = bodyHtml
    .replace('RELATIVETIMEPREVIEW', relativeTimeStr)
    .replace('FULLTIMEPREVIEW', fullTimeStr);

  // 6. Update DOM
  document.getElementById('discord-message-body').innerHTML = pingPrefix + bodyHtml;

  // 6. Update simulated timestamp at the top
  const now = new Date();
  const options = { hour: 'numeric', minute: '2-digit' };
  document.getElementById('discord-preview-timestamp').textContent = `Today at ${now.toLocaleTimeString([], options)}`;
}

// Open Form Panel for Add
function openAddPanel() {
  formAction.value = 'create';
  panelTitleText.textContent = 'Add New Deadline';
  idInput.disabled = false;
  
  // Set minimum date constraint to current local time
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  dateInput.min = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;

  // Fill defaults
  idInput.value = '';
  titleInput.value = '';
  dateInput.value = '';
  selectChannel.selectedIndex = 0;
  selectRole.value = defaults.defaultPingRole || 'everyone';
  alertTimeInput.value = defaults.defaultAlertTime || '09:00';
  timezoneInput.value = defaults.defaultTimezone || 'Asia/Kolkata';
  customTextInput.value = defaults.defaultCustomText || '';
  selectUpdateType.value = 'edit';

  updateDiscordPreview();
  formPanel.classList.remove('hidden');
}

// Open Form Panel for Edit
function openEditPanel(id) {
  const d = deadlines.find(item => item.id === id);
  if (!d) return;

  formAction.value = 'edit';
  originalIdInput.value = d.id;
  panelTitleText.textContent = `Edit Deadline: ${d.id}`;
  idInput.value = d.id;
  idInput.disabled = true; // Cannot edit ID directly
  
  titleInput.value = d.title;
  
  // Remove future date min constraint for edit to prevent breaking if current target is near/past
  dateInput.removeAttribute('min');

  // Format ISO target date to YYYY-MM-DDTHH:MM (first 16 chars) for native input
  if (d.targetDate && d.targetDate.length >= 16) {
    dateInput.value = d.targetDate.substring(0, 16);
  } else {
    dateInput.value = '';
  }

  selectChannel.value = d.channelId;
  selectRole.value = d.pingRole;
  alertTimeInput.value = d.alertTime;
  timezoneInput.value = d.timezone;
  customTextInput.value = d.customText;
  selectUpdateType.value = d.updateType || 'edit';

  updateDiscordPreview();
  formPanel.classList.remove('hidden');
}

// Close Panel
function closePanel() {
  formPanel.classList.add('hidden');
}

// Delete Deadline request
async function deleteDeadline(id) {
  if (!confirm(`Are you sure you want to delete deadline "${id}"?`)) return;

  try {
    const res = await fetch(`/api/deadlines/${id}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      showToast(`Deleted deadline: ${id}`);
      fetchDeadlines();
    } else {
      const err = await res.json();
      showToast(`❌ Error: ${err.error}`);
    }
  } catch (err) {
    showToast('❌ Server error during delete');
  }
}

// Handle Form Submit
deadlineForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const isEdit = formAction.value === 'edit';
  const id = idInput.value.trim();
  const url = isEdit ? `/api/deadlines/${originalIdInput.value}` : '/api/deadlines';
  const method = isEdit ? 'PUT' : 'POST';

  const bodyData = {
    id,
    title: titleInput.value.trim(),
    date: dateInput.value.trim(),
    channelId: selectChannel.value,
    pingRole: selectRole.value,
    alertTime: alertTimeInput.value.trim() || undefined,
    timezone: timezoneInput.value.trim() || undefined,
    customText: customTextInput.value.trim() || undefined,
    updateType: selectUpdateType.value
  };

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyData)
    });

    const data = await res.json();

    if (res.ok) {
      showToast(isEdit ? `Updated deadline: ${id}` : `Scheduled deadline: ${id}`);
      closePanel();
      fetchDeadlines();
    } else {
      showToast(`❌ Error: ${data.error || 'Request failed'}`);
    }
  } catch (err) {
    showToast('❌ Server connection failure');
  }
});

// Tab Switching logic
function switchTab(tabId) {
  if (tabId === 'dashboard') {
    navDashboard.classList.add('active');
    navDocs.classList.remove('active');
    tabDashboard.classList.remove('hidden');
    tabDocs.classList.add('hidden');
  } else if (tabId === 'docs') {
    navDashboard.classList.remove('active');
    navDocs.classList.add('active');
    tabDashboard.classList.add('hidden');
    tabDocs.classList.remove('hidden');
  }
}

// Event Listeners
navDashboard.addEventListener('click', (e) => {
  e.preventDefault();
  switchTab('dashboard');
});

navDocs.addEventListener('click', (e) => {
  e.preventDefault();
  switchTab('docs');
});

btnShowAddPanel.addEventListener('click', openAddPanel);
btnClosePanel.addEventListener('click', closePanel);
btnCancelForm.addEventListener('click', closePanel);
document.getElementById('modal-backdrop').addEventListener('click', closePanel);

// Automatic ID Slug validation/sanitization
idInput.addEventListener('input', () => {
  idInput.value = idInput.value
    .toLowerCase()
    .replace(/[^a-z0-9\-]/g, '-')
    .replace(/-+/g, '-');
});

idInput.addEventListener('blur', () => {
  idInput.value = idInput.value.replace(/^-+|-+$/g, '');
});

// Real-time Discord preview live update event bindings
titleInput.addEventListener('input', () => {
  if (formAction.value === 'create') {
    idInput.value = titleInput.value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-');
  }
  updateDiscordPreview();
});
dateInput.addEventListener('input', updateDiscordPreview);
dateInput.addEventListener('change', updateDiscordPreview);
selectRole.addEventListener('change', updateDiscordPreview);
customTextInput.addEventListener('input', updateDiscordPreview);

// Toolbar Button Helper: Insert placeholder or wrap text with formatting tag
function insertOrWrapText(action, value) {
  const textarea = customTextInput;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  
  textarea.focus();
  
  if (action === 'placeholder') {
    // Just insert placeholder at cursor
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    textarea.value = before + value + after;
    
    // Position cursor after inserted placeholder
    const newCursorPos = start + value.length;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
  } else if (action === 'format') {
    // Wrap selected text with format tags (e.g. **selection**)
    const before = text.substring(0, start);
    const selection = text.substring(start, end);
    const after = text.substring(end, text.length);
    
    textarea.value = before + value + selection + value + after;
    
    // Position cursor to contain original selection with format tags
    const newStart = start + value.length;
    const newEnd = end + value.length;
    textarea.setSelectionRange(newStart, newEnd);
  }
  
  // Trigger preview update manually
  updateDiscordPreview();
}

// Bind click listeners for all toolbar buttons
document.querySelectorAll('.toolbar-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const action = btn.dataset.action;
    const value = btn.dataset.value;
    insertOrWrapText(action, value);
  });
});

// Countdown Ticker Loop (Every 1 second)
setInterval(() => {
  document.querySelectorAll('.countdown-time').forEach(el => {
    const target = el.dataset.target;
    if (target) {
      el.textContent = getCountdownText(target);
    }
  });
}, 1000);

// Init Load
async function init() {
  await fetchDiscordData();
  await fetchDeadlines();
}

init();
