import Peer from 'peerjs';
import './style.css';

const app = document.querySelector('#app');
const STORAGE_NAME = 'ecase-chat-name';
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
  startedAt: null,
  reconnectTimer: null,
};

const defaultRoom = getRoomFromUrl() || makeRoomName();

renderJoin();

function renderJoin() {
  cleanupSession();
  app.innerHTML = `
    <main class="page-shell join-shell">
      <section class="join-card">
        <div class="brand-lockup">
          <div class="brand-mark">e<span>·</span></div>
          <div>
            <p class="eyebrow">ECΛSE / CHAT</p>
            <h1>Nói chuyện, <em>tự nhiên.</em></h1>
          </div>
        </div>

        <p class="intro">Tạo một cái tên, chọn phòng và gửi link cho mọi người. Không tài khoản, không cần cài app.</p>

        <form id="join-form" class="join-form">
          <label>
            <span>Tên hiển thị</span>
            <input id="name-input" name="name" maxlength="28" placeholder="Ví dụ: Minh Anh" autocomplete="nickname" required />
          </label>
          <label>
            <span>Tên phòng</span>
            <div class="room-input-wrap">
              <input id="room-input" name="room" maxlength="32" value="${escapeHtml(defaultRoom)}" placeholder="Ví dụ: team-ecase" required />
              <button id="random-room" type="button" class="icon-button" title="Tạo tên phòng ngẫu nhiên" aria-label="Tạo tên phòng ngẫu nhiên">↗</button>
            </div>
          </label>
          <button class="primary-button" type="submit">Vào phòng <span>→</span></button>
        </form>

        <div class="join-note">
          <span class="live-dot"></span>
          <span>Chat realtime ngang hàng · tin nhắn không được lưu trên server</span>
        </div>
      </section>
      <p class="page-footnote">Một góc nhỏ để nói chuyện cùng nhau.</p>
    </main>
  `;

  const savedName = localStorage.getItem(STORAGE_NAME);
  if (savedName) document.querySelector('#name-input').value = savedName;

  document.querySelector('#random-room').addEventListener('click', () => {
    document.querySelector('#room-input').value = makeRoomName();
  });
  document.querySelector('#join-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startSession(String(form.get('name') || ''), String(form.get('room') || ''));
  });
}

function startSession(rawName, rawRoom) {
  state.name = cleanName(rawName);
  state.roomLabel = cleanRoom(rawRoom);
  if (!state.name || !state.roomLabel) return;

  localStorage.setItem(STORAGE_NAME, state.name);
  state.roomKey = makeRoomKey(state.roomLabel);
  state.hostId = `${HOST_PREFIX}${state.roomKey}-host`;
  state.startedAt = Date.now();
  state.members = new Map();
  state.messages = [];
  history.replaceState({}, '', `${location.pathname}?room=${encodeURIComponent(state.roomLabel)}`);
  renderRoom();
  createHostPeer();
}

function renderRoom() {
  app.innerHTML = `
    <main class="chat-shell">
      <header class="topbar">
        <div class="brand-lockup compact">
          <div class="brand-mark">e<span>·</span></div>
          <div>
            <p class="eyebrow">ECΛSE / CHAT</p>
            <h1>${escapeHtml(state.roomLabel)}</h1>
          </div>
        </div>
        <div class="topbar-actions">
          <div id="connection-status" class="status-pill connecting"><span class="status-dot"></span><span>Đang kết nối</span></div>
          <button id="share-room" class="secondary-button">Chia sẻ phòng <span>↗</span></button>
          <button id="leave-room" class="ghost-button" title="Rời phòng" aria-label="Rời phòng">×</button>
        </div>
      </header>

      <div class="chat-layout">
        <aside class="members-panel">
          <div class="panel-heading">
            <span>Đang ở đây</span>
            <span id="member-count" class="count-badge">1</span>
          </div>
          <div id="member-list" class="member-list"></div>
          <div class="privacy-card">
            <span class="privacy-icon">⌁</span>
            <div>
              <strong>Ngang hàng</strong>
              <p>Kết nối trực tiếp giữa các trình duyệt. Phòng sẽ hoạt động khi có ít nhất một người đang mở.</p>
            </div>
          </div>
        </aside>

        <section class="conversation">
          <div id="message-list" class="message-list" aria-live="polite"></div>
          <div class="composer-wrap">
            <div id="composer-hint" class="composer-hint">Bạn đang nói chuyện với mọi người trong phòng</div>
            <form id="message-form" class="composer">
              <textarea id="message-input" rows="1" maxlength="1000" placeholder="Viết gì đó..." aria-label="Nội dung tin nhắn"></textarea>
              <button type="submit" class="send-button" title="Gửi tin nhắn" aria-label="Gửi tin nhắn">↑</button>
            </form>
          </div>
        </section>
      </div>
    </main>
  `;

  document.querySelector('#share-room').addEventListener('click', shareRoom);
  document.querySelector('#leave-room').addEventListener('click', leaveRoom);
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

  if (!state.isHost && payload.type === 'room:init') {
    state.messages = Array.isArray(payload.messages) ? payload.messages.slice(-MAX_MESSAGES) : [];
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
  renderMessages();
}

function broadcastPresence() {
  const payload = { type: 'presence', members: [...state.members.values()] };
  for (const connection of state.connections.values()) {
    if (connection.open) connection.send(payload);
  }
}

function renderMembers() {
  const list = document.querySelector('#member-list');
  const count = document.querySelector('#member-count');
  if (!list || !count) return;
  count.textContent = String(state.members.size || 1);
  const members = [...state.members.values()];
  if (!members.length) {
    members.push({ id: state.peerId || 'me', name: state.name, isHost: state.isHost });
  }
  list.innerHTML = members.map((member) => `
    <div class="member-row">
      <span class="avatar" style="--avatar-color: ${avatarColor(member.name)}">${escapeHtml(initials(member.name))}</span>
      <span class="member-name">${escapeHtml(member.name)}${member.id === state.peerId ? ' <small>(bạn)</small>' : ''}</span>
      ${member.isHost ? '<span class="host-label">chủ phòng</span>' : ''}
    </div>
  `).join('');
}

function renderMessages() {
  const list = document.querySelector('#message-list');
  if (!list) return;
  if (!state.messages.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-orb">✦</div>
        <h2>Phòng đang yên tĩnh</h2>
        <p>Gửi tin nhắn đầu tiên, hoặc chia sẻ link để mời mọi người vào.</p>
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

async function shareRoom() {
  const link = `${location.origin}${location.pathname}?room=${encodeURIComponent(state.roomLabel)}`;
  try {
    await navigator.clipboard.writeText(link);
    showSystemNotice('Đã sao chép link phòng. Gửi link này cho mọi người nhé.');
  } catch {
    showSystemNotice(link);
  }
}

function leaveRoom() {
  cleanupSession();
  history.replaceState({}, '', location.pathname);
  renderJoin();
}

function cleanupSession() {
  clearTimeout(state.reconnectTimer);
  state.hostConnection?.close();
  for (const connection of state.connections.values()) connection.close();
  state.peer?.destroy();
  state.peer = null;
  state.hostConnection = null;
  state.connections.clear();
  state.members.clear();
  state.messages = [];
  state.connected = false;
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
      hint.textContent = 'Bạn đang nói chuyện với mọi người trong phòng';
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

function getRoomFromUrl() {
  return new URLSearchParams(location.search).get('room')?.trim() || '';
}

function cleanName(value) {
  return value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 28);
}

function cleanRoom(value) {
  return value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 32);
}

function cleanMessage(value) {
  return value.replace(/\u0000/g, '').trim().slice(0, 1000);
}

function makeRoomKey(label) {
  const normalized = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  let hash = 2166136261;
  for (const character of normalized) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  const slug = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 16) || 'room';
  return `${slug}-${(hash >>> 0).toString(36)}`;
}

function makeRoomName() {
  const first = ['mây', 'nắng', 'lá', 'gió', 'sóng', 'sao', 'trà', 'đom-đóm'];
  const second = ['xanh', 'nhẹ', 'vui', 'nhỏ', 'đêm', 'sáng', 'ấm', 'bay'];
  return `${first[Math.floor(Math.random() * first.length)]}-${second[Math.floor(Math.random() * second.length)]}`;
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
