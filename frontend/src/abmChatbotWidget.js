import './abmChatbotWidget.css';

const STORAGE_KEY = 'civicTwinABMChatHistory';
const COMPLAINT_CACHE_KEY = 'civicTwinComplaintContextCache';

function getSimulationBaseUrl() {
  return import.meta.env.VITE_SIMULATION_API_URL || 'http://localhost:8001';
}

function getCandidateBaseUrls() {
  const envUrl = import.meta.env.VITE_SIMULATION_API_URL;
  const urls = [];

  if (envUrl) {
    urls.push(envUrl);
  }

  urls.push('http://localhost:8001');
  urls.push('http://localhost:8000');

  // Ensure unique values while preserving order.
  return [...new Set(urls)];
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function saveHistory(history) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-40)));
}

function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
}

function loadComplaintCache() {
  try {
    const raw = localStorage.getItem(COMPLAINT_CACHE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function saveComplaintCache(complaints) {
  try {
    localStorage.setItem(COMPLAINT_CACHE_KEY, JSON.stringify((complaints || []).slice(0, 50)));
  } catch (_error) {
    // Ignore storage issues.
  }
}

function makeRow(role, text) {
  const row = document.createElement('div');
  row.className = `abm-chat-row ${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'abm-chat-bubble';
  bubble.textContent = text;

  row.appendChild(bubble);
  return row;
}

function pushMessage(container, history, role, text) {
  const clean = String(text || '').trim();
  if (!clean) {
    return;
  }
  history.push({ role, text: clean });
  saveHistory(history);
  container.appendChild(makeRow(role, clean));
  container.scrollTop = container.scrollHeight;
}

function getCurrentProfile() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) {
      return null;
    }
    const profile = JSON.parse(raw);
    return profile && typeof profile === 'object' ? profile : null;
  } catch (_error) {
    return null;
  }
}

function shouldFetchComplaintContext(message) {
  const lowered = String(message || '').toLowerCase();
  return (
    lowered.includes('my complaints') ||
    lowered.includes('i have filed') ||
    lowered.includes('i filed') ||
    lowered.includes('what did i file')
  );
}

async function fetchComplaintContext() {
  const token = localStorage.getItem('token');
  if (!token) {
    return [];
  }

  const apiBase = import.meta.env.VITE_API_URL || '';
  const candidates = [];

  if (apiBase) {
    candidates.push(`${apiBase}/complaints`);
  }
  candidates.push('/complaints');
  candidates.push('http://localhost:3000/complaints');

  for (const url of [...new Set(candidates)]) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      const list = Array.isArray(data?.data) ? data.data : [];
      if (list.length > 0) {
        saveComplaintCache(list);
      }
      return list.slice(0, 30);
    } catch (_error) {
      // Try next candidate URL.
    }
  }

  return loadComplaintCache().slice(0, 30);
}

async function sendChatMessage(message) {
  const candidateUrls = getCandidateBaseUrls();
  let lastError = null;
  const profile = getCurrentProfile();
  const complaintContext = shouldFetchComplaintContext(message)
    ? await fetchComplaintContext()
    : [];
  const authToken = localStorage.getItem('token');
  const payload = {
    message,
    profile,
    complaint_context: complaintContext,
    auth_token: authToken || null
  };

  for (const baseUrl of candidateUrls) {
    try {
      const response = await fetch(`${baseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const reason = await response.text();
        throw new Error(`Chat service returned ${response.status}: ${reason}`);
      }

      return response.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `Unable to reach simulation service. Checked: ${candidateUrls.join(', ')}. ${lastError ? String(lastError.message || lastError) : ''}`
  );
}

function mountABMWidget() {
  if (document.getElementById('abm-chat-panel')) {
    return;
  }

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'abm-chat-toggle';
  toggle.textContent = 'ABM';
  toggle.setAttribute('aria-label', 'Open ABM assistant');

  const panel = document.createElement('section');
  panel.id = 'abm-chat-panel';
  panel.className = 'abm-chat-panel';

  const header = document.createElement('header');
  header.className = 'abm-chat-header';
  header.innerHTML = '<span>CivicTwin Rasa Assistant</span>';

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'abm-chat-close';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Close chatbot');
  header.appendChild(close);

  const messages = document.createElement('div');
  messages.className = 'abm-chat-messages';

  const inputWrap = document.createElement('div');
  inputWrap.className = 'abm-chat-input-wrap';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'abm-chat-input';
  input.placeholder = 'Ask about unemployment, income, migration, rent';

  const send = document.createElement('button');
  send.type = 'button';
  send.className = 'abm-chat-send';
  send.textContent = 'Send';

  const note = document.createElement('p');
  note.className = 'abm-chat-note';
  note.textContent = 'Ask anything about complaints, profile, or simulation insights.';

  inputWrap.appendChild(input);
  inputWrap.appendChild(send);

  panel.appendChild(header);
  panel.appendChild(messages);
  panel.appendChild(inputWrap);
  panel.appendChild(note);

  document.body.appendChild(toggle);
  document.body.appendChild(panel);

  let history = loadHistory();

  const renderFreshChat = () => {
    history = [
      {
        role: 'bot',
        text: 'Hello. I am your CivicTwin Rasa assistant. Ask me about complaints, profile details, and simulation insights.'
      }
    ];
    clearHistory();
    saveHistory(history);
    messages.innerHTML = '';
    messages.appendChild(makeRow('bot', history[0].text));
    messages.scrollTop = messages.scrollHeight;
  };

  if (history.length === 0) {
    renderFreshChat();
  } else {
    history.forEach((item) => {
      messages.appendChild(makeRow(item.role, item.text));
    });
    messages.scrollTop = messages.scrollHeight;
  }

  const setOpen = (open) => {
    panel.classList.toggle('open', open);
    if (open) {
      renderFreshChat();
      input.value = '';
      messages.scrollTop = 0;
      input.focus();
    }
  };

  toggle.addEventListener('click', () => {
    setOpen(!panel.classList.contains('open'));
  });

  close.addEventListener('click', () => setOpen(false));

  const handleSend = async () => {
    const text = input.value.trim();
    if (!text) {
      return;
    }

    input.value = '';
    pushMessage(messages, history, 'user', text);
    pushMessage(messages, history, 'bot', 'Thinking...');

    try {
      const response = await sendChatMessage(text);
      history.pop();
      messages.removeChild(messages.lastChild);
      pushMessage(messages, history, 'bot', response.answer || 'No response available.');
    } catch (error) {
      history.pop();
      messages.removeChild(messages.lastChild);
      pushMessage(messages, history, 'bot', error.message || 'Unable to connect to backend service.');
    }
  };

  send.addEventListener('click', handleSend);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      handleSend();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountABMWidget);
} else {
  mountABMWidget();
}
