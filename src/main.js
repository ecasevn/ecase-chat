import './style.css';

const app = document.querySelector('#app');
const STORAGE_NAME = 'ecase-chat-name';
const APP_MODE = getAppMode();

const state = {
  name: cleanName(localStorage.getItem(STORAGE_NAME) || '') || makeGuestName(),
  messages: [],
  sending: false,
};

if (APP_MODE === 'admin') renderAdmin();
else if (APP_MODE === 'dev') renderDev();
else renderRoom();
loadMessages();
setInterval(loadMessages, 1000);

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
          <div id="connection-status" class="status-pill connecting"><span class="status-dot"></span><span>Đang kết nối</span></div>
        </div>
      </header>

      <div class="chat-layout">
        <section class="conversation">
          <div class="conversation-head">
            <h2>Chat chung</h2>
            <p>Gửi tin nhắn và trò chuyện cùng mọi người trong phòng.</p>
          </div>
          <div id="message-list" class="message-list" aria-live="polite"></div>
          <div class="composer-wrap">
            <div id="composer-hint" class="composer-hint">Lịch sử chat dùng chung, không phân trang</div>
            <form id="message-form" class="composer">
              <textarea id="message-input" rows="1" maxlength="1000" placeholder="Viết gì đó..." aria-label="Nội dung tin nhắn"></textarea>
              <button id="send-button" type="submit" class="send-button" title="Gửi tin nhắn" aria-label="Gửi tin nhắn">↑</button>
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
  renderMessages();
}

function renderAdmin() {
  app.innerHTML = `
    <main class="admin-shell">
      <header class="topbar admin-topbar">
        <div class="brand-lockup compact">
          <div class="brand-mark">e<span>·</span></div>
          <div>
            <p class="eyebrow">ECΛSE / ADMIN</p>
            <h1>Quản lý chat</h1>
          </div>
        </div>
        <div class="topbar-actions">
          <span id="message-total" class="admin-total">0 tin nhắn</span>
          <div id="connection-status" class="status-pill connecting"><span class="status-dot"></span><span>Đang kết nối</span></div>
        </div>
      </header>
      <section class="admin-content">
        <div class="admin-toolbar">
          <div>
            <h2>Tất cả tin nhắn</h2>
            <p>Xem, kiểm tra và dọn dẹp nội dung trong phòng.</p>
          </div>
          <button id="clear-messages" class="danger-button" type="button">Xóa toàn bộ</button>
        </div>
        <div id="message-list" class="message-list admin-message-list" aria-live="polite"></div>
      </section>
    </main>
  `;
  document.querySelector('#clear-messages').addEventListener('click', clearMessages);
  renderMessages();
}

function renderDev() {
  app.innerHTML = `
    <main class="dev-shell">
      <header class="topbar dev-topbar">
        <div class="brand-lockup compact">
          <div class="brand-mark">e<span>·</span></div>
          <div>
            <p class="eyebrow">ECΛSE / DEV</p>
            <h1>Bảng kiểm tra</h1>
          </div>
        </div>
        <div class="topbar-actions">
          <span id="message-total" class="admin-total">0 tin nhắn</span>
          <div id="connection-status" class="status-pill connecting"><span class="status-dot"></span><span>Đang kết nối</span></div>
        </div>
      </header>
      <section class="dev-content">
        <div class="dev-card">
          <p class="eyebrow">DEV PORT / 13000</p>
          <h2>Hoạt động phòng chat</h2>
          <p>Theo dõi số lượng tin nhắn và nội dung mới theo thời gian thực.</p>
          <div class="dev-stats">
            <div><span>Tổng tin nhắn</span><strong id="dev-message-count">0</strong></div>
            <div><span>Trạng thái</span><strong>Đang chạy</strong></div>
          </div>
        </div>
        <div id="message-list" class="message-list dev-message-list" aria-live="polite"></div>
      </section>
    </main>
  `;
  renderMessages();
}

async function loadMessages() {
  try {
    const response = await fetch('/api/messages', { cache: 'no-store' });
    if (!response.ok) throw new Error(`GET /api/messages failed: ${response.status}`);
    const messages = await response.json();
    state.messages = Array.isArray(messages) ? messages : [];
    const total = document.querySelector('#message-total');
    const devCount = document.querySelector('#dev-message-count');
    if (total) total.textContent = `${state.messages.length} tin nhắn`;
    if (devCount) devCount.textContent = String(state.messages.length);
    setConnectionStatus('online', 'Đã kết nối');
    renderMessages();
  } catch (error) {
    console.error(error);
    setConnectionStatus('offline', 'Mất kết nối');
  }
}

async function clearMessages() {
  if (!window.confirm('Xóa toàn bộ tin nhắn trong phòng?')) return;
  try {
    const response = await fetch('/api/messages', { method: 'DELETE' });
    if (!response.ok) throw new Error(`DELETE /api/messages failed: ${response.status}`);
    await loadMessages();
  } catch (error) {
    console.error(error);
    showSystemNotice('Không thể xóa tin nhắn lúc này.');
  }
}

async function sendMessage() {
  const input = document.querySelector('#message-input');
  const text = cleanMessage(input?.value || '');
  if (!text || state.sending) return;

  state.sending = true;
  input.value = '';
  input.style.height = 'auto';
  document.querySelector('#send-button').disabled = true;

  try {
    const response = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: state.name, text }),
    });
    if (!response.ok) throw new Error(`POST /api/messages failed: ${response.status}`);
    await loadMessages();
  } catch (error) {
    console.error(error);
    input.value = text;
    showSystemNotice('Không thể gửi tin nhắn lúc này.');
  } finally {
    state.sending = false;
    document.querySelector('#send-button').disabled = false;
    input.focus();
  }
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
    const grouped = previous?.name === message.name && message.at - previous.at < 5 * 60 * 1000;
    const mine = message.name === state.name;
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

function setConnectionStatus(type, text) {
  const status = document.querySelector('#connection-status');
  if (!status) return;
  status.className = `status-pill ${type}`;
  status.innerHTML = `<span class="status-dot"></span><span>${escapeHtml(text)}</span>`;
}

function showSystemNotice(message) {
  const hint = document.querySelector('#composer-hint');
  if (!hint) return;
  hint.textContent = message;
  hint.classList.add('notice');
  setTimeout(() => {
    hint.textContent = 'Lịch sử chat dùng chung, không phân trang';
    hint.classList.remove('notice');
  }, 4000);
}

function autoGrow(event) {
  event.currentTarget.style.height = 'auto';
  event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 140)}px`;
}

function cleanName(value) {
  return String(value || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 28);
}

function cleanMessage(value) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, 1000);
}

function makeGuestName() {
  return `Khách-${Math.floor(1000 + Math.random() * 9000)}`;
}

function initials(name) {
  return String(name).split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join('').toUpperCase() || '?';
}

function avatarColor(name) {
  let hash = 0;
  for (const character of String(name)) hash = character.charCodeAt(0) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360} 70% 65%)`;
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(Number(timestamp));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function getAppMode() {
  const hostname = window.location.hostname;
  if (window.location.port === '5174' || hostname.startsWith('admin.')) return 'admin';
  if (window.location.port === '13000' || hostname.startsWith('dev.')) return 'dev';
  return 'user';
}
