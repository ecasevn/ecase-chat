import Peer from 'peerjs';
import './style.css';

const app = document.querySelector('#app');
const STORAGE_NAME = 'ecase-chat-name';
const STORAGE_MESSAGES = 'ecase-chat-messages-public';
const MAX_MESSAGES = 100;
const HOST_PREFIX = 'ecase-chat-';

const state = {
  name: '',
  roomLabel: '',
  roomKey: '',
  hostId: '',
  peerId: '',
  peer: null,
  hostConnection: null,
  connections: new Map(),
  members: new Map(),
  messages: [],
  isHost: false,
  connected: false,
  reconnectTimer: null,
};

state.name = cleanName(localStorage.getItem(STORAGE_NAME) || '') || makeGuestName();
state.messages = loadMessages();
state.roomLabel = 'Phòng chung';
state.roomKey = 'public';
state.hostId = `${HOST_PREFIX}public-host`;
renderRoom();
createHostPeer();

function renderRoom() {
  app.innerHTML = `
    <main class="chat-shell">
      <header class="topbar">
        <div class="brand-lockup compact">
          <div class="brand-mark">e<span>·</span></div>
          <div>
            <p class="eyebrow">ECΛSE / CHAT</p>
            <h1>Phòng chung</h1>
          </div>
        </div>
        <div class="topbar-actions">
          <label class="name-control">
            <span>Tên</span>
            <input id="name-input" value="${escapeHtml(state.name)}" maxlength="28" autocomplete="nickname" aria-label="Tên hiển thị" />
          </label>
          <div class="online-count"><span class="live-dot"></span><span id="member-count">1 online</span></div>
          <div id="connection-status" class="status-pill connecting"><span class="status-dot"></span><span>Đang kết nối</span></div>
        </div>
      </header>

      <div class="chat-layout">
        <section class="conversation">
          <div class="conversation-head">
            <h2>Chat chung</h2>
            <p>Vào là nói chuyện. Lịch sử được lưu trên trình duyệt này.</p>
          </div>
          <div id="message-list" class="message-list" aria-live="polite"></div>
          <div class="composer-wrap">
            <div id="composer-hint" class="composer-hint">Tin nhắn sẽ hiện với mọi người đang online</div>
            <form id="message-form" class="composer">
              <textarea id="message-input" rows="1" maxlength="1000" placeholder="Viết gì đó..." aria-label="Nội dung tin nhắn"></textarea>
              <button type="submit" class="send-button" title="Gửi tin nhắn" aria-label="Gửi tin nhắn">↑</button>
            </form>
          </div>
        </section>
      </div>
    </main>
  `;

  document.querySelector('#name-input').addEventListener('input', (event) => {
    const nextName = cleanName(event.currentTarget.value);
    if (!nextName) return;
    state.name = nextName;
    localStorage.setItem(STORAGE_NAME, state.name);
  });
  document.querySelector('#name-input').addEventListener('change', updateProfile);
  document.querySelector('#message-form').addEventListener('submit', (event) => {
    event.preventDefault();
    sendMessage();
  });
  document.querySelector('#message-input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });
  document.querySelector('#message-input').addEventListener('input', autoGrow);
  renderMembers();
  renderMessages();
}

function updateProfile() {
  const member = state.members.get(state.peerId);
  if (member) member.name = state.name;
  if (state.isHost) {
    broadcastPresence();
  } else if (state.hostConnection?.open) {
    state.hostConnection.send({ type: 'profile:update', name: state.name });
  }
}

function createHostPeer() {
  state.isHost = true;
  setConnectionStatus('connecting', 'Đang mở phòng');
  state.peer = new Peer(state.hostId);
  state.peer.on('open', (id) => {
    state.peerId = id;
    state.connected = true;
    state.members.set(id, { id, name: state.name, isHost: true });
    setConnectionStatus('online', 'Phòng đang mở');
    renderMembers();
  });
  state.peer.on('connection', (connection) => {
    setupConnection(connection, true);
  });
  state.peer.on('error', (error) => {
    if (error.type === 'unavailable-id' && state.isHost) {
      state.isHost = false;
      state.peer?.destroy();
      createGuestPeer();
      return;
    }
    showConnectionError(error);
  });
  state.peer.on('disconnected', () => {
    state.connected = false;
    setConnectionStatus('connecting', 'Đang nối lại');
    state.peer.reconnect();
  });
}

function createGuestPeer() {
  state.isHost = false;
  setConnectionStatus('connecting', 'Đang tìm phòng');
  state.peer = new Peer();
  state.peer.on('open', (id) => {
    state.peerId = id;
    connectToHost();
  });
  state.peer.on('error', (error) => {
    if (error.type === 'peer-unavailable') {
      setConnectionStatus('offline', 'Chưa thấy chủ phòng');
      scheduleHostRetry();
    } else {
      showConnectionError(error);
    }
  });
  state.peer.on('disconnected', () => {
    state.connected = false;
    setConnectionStatus('connecting', 'Đang nối lại');
    state.peer.reconnect();
  });
}

function connectToHost() {
  if (!state.peer || state.peer.destroyed || state.isHost) return;
  clearTimeout(state.reconnectTimer);
  const connection = state.peer.connect(state.hostId, {
    reliable: true,
    metadata: { name: state.name },
  });
  state.hostConnection = connection;
  setupConnection(connection, false);
}

function setupConnection(connection, incoming) {
  if (incoming) state.connections.set(connection.peer, connection);

  connection.on('open', () => {
    if (!incoming) {
      state.connected = true;
      setConnectionStatus('online', 'Đã vào phòng');
    }
    if (state.isHost) {
      const guestName = cleanName(connection.metadata?.name || 'Khách');
      state.members.set(connection.peer, { id: connection.peer, name: guestName || 'Khách' });
      connection.send({
        type: 'room:init',
        messages: state.messages,
        members: [...state.members.values()],
      });
      broadcastPresence();
      renderMembers();
    }
  });

  connection.on('data', (payload) => handlePayload(connection, payload));
  connection.on('close', () => {
    if (state.isHost) {
      state.connections.delete(connection.peer);
      state.members.delete(connection.peer);
      broadcastPresence();
      renderMembers();
    } else if (connection === state.hostConnection) {
      state.connected = false;
      setConnectionStatus('offline', 'Chủ phòng đã rời');
      showSystemNotice('Chủ phòng đã rời. Hãy thử tải lại link khi họ mở phòng lại.');
    }
  });
  connection.on('error', () => {
    if (!state.isHost) {
      state.connected = false;
      setConnectionStatus('offline', 'Không thể kết nối');
    }
  });
}

function handlePayload(connection, payload) {
  if (!payload || typeof payload !== 'object') return;

  if (state.isHost && payload.type === 'message:send') {
    const text = cleanMessage(payload.text);
    if (!text) return;
    publishMessage({
      id: makeId(),
      text,
      name: state.members.get(connection.peer)?.name || 'Khách',
      peerId: connection.peer,
      at: Date.now(),
    });
    return;
  }

  if (state.isHost && payload.type === 'profile:update') {
    const member = state.members.get(connection.peer);
    if (member) member.name = cleanName(payload.name) || 'Khách';
    broadcastPresence();
    renderMembers();
    return;
  }

  if (!state.isHost && payload.type === 'room:init') {
    state.messages = Array.isArray(payload.messages) ? payload.messages.slice(-MAX_MESSAGES) : [];
    saveMessages();
    state.members = new Map((payload.members || []).map((member) => [member.id, member]));
    renderMessages();
    renderMembers();
    return;
  }

  if (!state.isHost && payload.type === 'message:new') {
    appendMessage(payload.message);
    return;
  }

  if (!state.isHost && payload.type === 'presence') {
    state.members = new Map((payload.members || []).map((member) => [member.id, member]));
    renderMembers();
  }
}

function sendMessage() {
  const input = document.querySelector('#message-input');
  const text = cleanMessage(input?.value || '');
  if (!text || !state.connected) return;

  input.value = '';
  input.style.height = 'auto';
  if (state.isHost) {
    publishMessage({ id: makeId(), text, name: state.name, peerId: state.peerId, at: Date.now() });
  } else if (state.hostConnection?.open) {
    state.hostConnection.send({ type: 'message:send', text });
  }
}

function publishMessage(message) {
  appendMessage(message);
  for (const connection of state.connections.values()) {
    if (connection.open) connection.send({ type: 'message:new', message });
  }
}

function appendMessage(message) {
  if (!message?.text || state.messages.some((item) => item.id === message.id)) return;
  state.messages.push(message);
  state.messages = state.messages.slice(-MAX_MESSAGES);
  saveMessages();
  renderMessages();
}

function broadcastPresence() {
  const payload = { type: 'presence', members: [...state.members.values()] };
  for (const connection of state.connections.values()) {
    if (connection.open) connection.send(payload);
  }
}

function renderMembers() {
  const count = document.querySelector('#member-count');
  if (!count) return;
  count.textContent = `${state.members.size || 1} online`;
}

function renderMessages() {
  const list = document.querySelector('#message-list');
  if (!list) return;
  if (!state.messages.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-orb">✦</div>
        <h2>Chưa có tin nhắn</h2>
        <p>Viết câu đầu tiên để bắt đầu cuộc trò chuyện.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = state.messages.map((message, index) => {
    const previous = state.messages[index - 1];
    const grouped = previous?.peerId === message.peerId && message.at - previous.at < 5 * 60 * 1000;
    const mine = message.peerId === state.peerId;
    return `
      <article class="message-row ${mine ? 'mine' : ''} ${grouped ? 'grouped' : ''}">
        ${grouped ? '<div class="avatar-spacer"></div>' : `<span class="avatar" style="--avatar-color: ${avatarColor(message.name)}">${escapeHtml(initials(message.name))}</span>`}
        <div class="message-body">
          ${grouped ? '' : `<div class="message-meta"><strong>${escapeHtml(message.name)}</strong><time>${formatTime(message.at)}</time></div>`}
          <div class="message-bubble">${escapeHtml(message.text).replaceAll('\n', '<br />')}</div>
        </div>
      </article>
    `;
  }).join('');
  list.scrollTop = list.scrollHeight;
}

function scheduleHostRetry() {
  clearTimeout(state.reconnectTimer);
  state.reconnectTimer = setTimeout(() => {
    if (!state.isHost && state.peer && !state.peer.destroyed) connectToHost();
  }, 2500);
}

function showConnectionError(error) {
  console.error(error);
  setConnectionStatus('offline', 'Kết nối gặp lỗi');
  showSystemNotice('Không thể kết nối phòng lúc này. Kiểm tra mạng rồi thử tải lại trang.');
}

function showSystemNotice(message) {
  const hint = document.querySelector('#composer-hint');
  if (!hint) return;
  hint.textContent = message;
  hint.classList.add('notice');
  setTimeout(() => {
    if (hint) {
      hint.textContent = 'Tin nhắn sẽ hiện với mọi người đang online';
      hint.classList.remove('notice');
    }
  }, 4500);
}

function setConnectionStatus(type, text) {
  const status = document.querySelector('#connection-status');
  if (!status) return;
  status.className = `status-pill ${type}`;
  status.innerHTML = `<span class="status-dot"></span><span>${escapeHtml(text)}</span>`;
}

function autoGrow(event) {
  event.currentTarget.style.height = 'auto';
  event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 140)}px`;
}

function cleanName(value) {
  return value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 28);
}

function cleanMessage(value) {
  return value.replace(/\u0000/g, '').trim().slice(0, 1000);
}

function loadMessages() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_MESSAGES) || '[]');
    if (!Array.isArray(stored)) return [];
    return stored
      .filter((message) => message && typeof message.text === 'string')
      .map((message) => ({
        id: String(message.id || makeId()),
        text: cleanMessage(message.text),
        name: cleanName(String(message.name || 'Khách')) || 'Khách',
        peerId: String(message.peerId || ''),
        at: Number.isFinite(Number(message.at)) ? Number(message.at) : Date.now(),
      }))
      .filter((message) => message.text)
      .slice(-MAX_MESSAGES);
  } catch {
    return [];
  }
}

function saveMessages() {
  try {
    localStorage.setItem(STORAGE_MESSAGES, JSON.stringify(state.messages.slice(-MAX_MESSAGES)));
  } catch {
    // localStorage có thể bị tắt trong chế độ private hoặc trình duyệt giới hạn dung lượng.
  }
}

function makeGuestName() {
  return `Khách-${Math.floor(1000 + Math.random() * 9000)}`;
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join('').toUpperCase() || '?';
}

function avatarColor(name) {
  let hash = 0;
  for (const character of name) hash = character.charCodeAt(0) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360} 70% 65%)`;
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(timestamp);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}
