import './lobby.css';

const ROUTES = { mountain: 'Alpine Pass', nordschleife: 'Nürburgring Nordschleife' };
const WEATHER = { day: 'Clear daylight', golden: 'Golden hour', overcast: 'Overcast', rain: 'Rain' };
const MODES = { free: 'Free Drive', race: 'Race' };
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function button(text, action, className = '') {
  const node = el('button', `mp-button ${className}`, text);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}
function field(parent, text, name, options, value = '') {
  const label = el('label', 'mp-field');
  label.append(el('span', '', text));
  const input = el(options ? 'select' : 'input');
  input.name = name;
  if (options) for (const [key, caption] of Object.entries(options)) {
    const option = el('option', '', caption); option.value = key; input.append(option);
  }
  else { input.type = 'text'; input.maxLength = name === 'code' ? 8 : 32; input.required = true; }
  if (value) input.value = value;
  label.append(input); parent.append(label);
  return input;
}
function values(form) { return Object.fromEntries(new FormData(form)); }
export class LobbyUI {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.available = true;
    this.room = null;
    this.selfId = null;
    this.pending = null;
    this.lobbies = [];
    this.openButton = button('MULTIPLAYER', () => { this._call('onOpen'); this.open(); }, 'mp-menu-button');
    this.openButton.id = 'multiplayer-open';
    this.openButton.setAttribute('aria-haspopup', 'dialog');
    (document.querySelector('footer nav') || document.querySelector('.menu') || document.body).append(this.openButton);
    this.dialog = el('dialog', 'mp-dialog');
    this.dialog.id = 'multiplayer-dialog';
    this.dialog.setAttribute('aria-labelledby', 'mp-title');
    const header = el('header', 'mp-header');
    const branding = el('div');
    branding.append(el('span', 'mp-eyebrow', 'APEX / LIVE SESSIONS'), el('h2', '', 'Drive together.'));
    branding.lastChild.id = 'mp-title';
    const close = button('×', () => this.close(), 'mp-close'); close.setAttribute('aria-label', 'Close multiplayer');
    header.append(branding, close);
    this.status = el('p', 'mp-status', 'Connect to find your next session.');
    this.status.setAttribute('role', 'status');
    this.error = el('p', 'mp-error'); this.error.hidden = true; this.error.setAttribute('role', 'alert');
    this.content = el('div', 'mp-content');
    this.dialog.append(header, this.status, this.error, this.content);
    document.body.append(this.dialog);
    this.dialog.addEventListener('cancel', event => { event.preventDefault(); this.close(); });
    this.dialog.addEventListener('close', () => {
      this._call('onClose');
      if (this.previousFocus?.isConnected) this.previousFocus.focus();
    });
    // Contain keys at the dialog: game controls must never see form typing.
    for (const type of ['keydown', 'keyup', 'keypress']) this.dialog.addEventListener(type, event => event.stopPropagation());
    this._render();
  }
  _call(name, data) { return this.callbacks[name]?.(data); }
  open() {
    if (this.dialog.open) return;
    this.previousFocus = document.activeElement;
    this.dialog.showModal();
  }
  close() { if (this.dialog.open) this.dialog.close(); }
  setStatus(message) { this.status.textContent = message || ''; }
  setError(message) { this.error.textContent = message || ''; this.error.hidden = !message; }
  setAvailable(available) { this.available = !!available; this._render(); }
  setLobbies(lobbies) { this.lobbies = Array.isArray(lobbies) ? lobbies : []; if (!this.room && !this.pending) this._renderBrowser(); }
  setPending(code) { this.pending = code; this.room = null; this.setError(''); this._render(); }
  setRoom(room, selfId) {
    // Membership/ready updates must not discard the host's unsubmitted setup.
    const sameSetup = room && this.room?.code === room.code && this.selfId === selfId && room.ownerId === selfId && JSON.stringify(this.room.config) === JSON.stringify(room.config);
    const editable = room && (room.phase === 'lobby' || room.config.mode === 'free');
    this.configDraft = sameSetup && editable && this.configEditable && this.configForm?.isConnected ? { ...values(this.configForm), laps: Number(this.configForm.elements.laps.value) } : null;
    this.room = room; this.selfId = selfId; this.pending = null; this.setError(''); this._render();
  }
  _render() {
    // Preserve an actively edited identity/configuration across lobby list updates.
    if (this.nameInput) this.driverName = this.nameInput.value;
    this.content.replaceChildren();
    this.nameInput = null;
    if (!this.available) {
      const box = el('section', 'mp-empty');
      box.append(el('span', 'mp-eyebrow', 'LIVE MULTIPLAYER'), el('h3', '', 'The paddock is offline.'), el('p', '', 'This build is not connected to a live multiplayer server. Solo driving is ready to go.'));
      box.append(button('Back to driving', () => this.close())); this.content.append(box); return;
    }
    if (this.room) { this._renderRoom(); return; }
    if (this.pending) {
      const box = el('section', 'mp-empty');
      box.append(el('span', 'mp-eyebrow', 'JOIN REQUEST SENT'), el('h3', '', 'Waiting at the gate'), el('p', '', `Room ${this.pending} · The host will approve your request. You can leave this screen open while you wait.`), button('Cancel request', () => this._call('onLeave')));
      this.content.append(box); return;
    }
    const intro = el('p', 'mp-description', 'Find a lobby or host your own. Join requests are approved by the host. Up to 8 drivers per session.');
    const identity = el('div', 'mp-identity');
    this.nameInput = field(identity, 'Your driver name', 'name', null, this.driverName || 'Driver');
    this.nameInput.autocomplete = 'nickname';
    this.content.append(intro, identity);
    const grid = el('div', 'mp-grid');
    const host = el('section', 'mp-card'); host.append(el('h3', '', 'Host a session'));
    const form = el('form', 'mp-form');
    field(form, 'Lobby name', 'lobbyName', null, 'Evening drive');
    this._configFields(form);
    const create = button('Create lobby ↗', () => {
      if (form.reportValidity() && this.nameInput.reportValidity()) this._call('onCreate', { ...values(form), name: this.nameInput.value.trim(), laps: Number(form.elements.laps.value) });
    }, 'mp-primary');
    form.addEventListener('submit', event => { event.preventDefault(); create.click(); });
    form.append(create); host.append(form);
    const join = el('section', 'mp-card'); join.append(el('h3', '', 'Join a session'));
    const request = el('form', 'mp-form mp-code-form');
    this.codeInput = field(request, 'Room code', 'code');
    this.codeInput.autocomplete = 'off'; this.codeInput.spellcheck = false;
    const requestButton = button('Request to join', () => this._request(this.codeInput.value));
    request.append(requestButton); request.addEventListener('submit', event => { event.preventDefault(); requestButton.click(); });
    join.append(request, el('h4', '', 'Open lobbies'));
    this.browser = el('div', 'mp-browser'); join.append(this.browser);
    grid.append(host, join); this.content.append(grid); this._renderBrowser();
  }
  _configFields(form, config = {}) {
    const grid = el('div', 'mp-config');
    field(grid, 'Session', 'mode', MODES, config.mode || 'free');
    field(grid, 'Route', 'route', ROUTES, config.route || 'mountain');
    field(grid, 'Weather', 'weather', WEATHER, config.weather || 'day');
    const laps = field(grid, 'Laps', 'laps', { 1: '1 lap', 2: '2 laps', 3: '3 laps', 4: '4 laps', 5: '5 laps' }, String(config.laps || 3));
    const update = () => { laps.disabled = form.elements.mode?.value === 'free'; };
    grid.querySelector('[name=mode]').addEventListener('change', update);
    form.append(grid); update();
  }
  _request(code) {
    if (!this.nameInput.reportValidity()) return;
    code = String(code).trim().toUpperCase();
    if (!code) { this.codeInput.reportValidity(); return; }
    this._call('onRequest', { name: this.nameInput.value.trim(), code });
  }
  _renderBrowser() {
    if (!this.browser?.isConnected || this.room || this.pending) return;
    this.browser.replaceChildren();
    if (!this.lobbies.length) { this.browser.append(el('p', 'mp-muted', 'No open lobbies yet. Create one and invite your friends.')); return; }
    for (const room of this.lobbies) {
      const row = el('div', 'mp-lobby'); const info = el('div');
      info.append(el('strong', '', room.name), el('span', 'mp-muted', `${MODES[room.mode] || room.mode} · ${ROUTES[room.route] || room.route} · ${room.players}/${room.maxPlayers || 8}`));
      const join = button('Join', () => this._request(room.code));
      join.disabled = room.players >= (room.maxPlayers || 8) || (room.mode === 'race' && room.phase !== 'lobby');
      row.append(info, join); this.browser.append(row);
    }
  }
  _renderRoom() {
    const room = this.room;
    const owner = room.ownerId === this.selfId;
    const self = room.players.find(player => player.id === this.selfId);
    const head = el('section', 'mp-room-heading');
    const title = el('div'); title.append(el('span', 'mp-eyebrow', 'YOUR SESSION'), el('h3', '', room.name));
    const code = el('div', 'mp-room-code'); code.append(el('span', '', 'INVITE CODE'), el('strong', '', room.code));
    head.append(title, code); this.content.append(head);
    this.phase = el('p', 'mp-phase'); this._phaseText(room); this.content.append(this.phase);
    const grid = el('div', 'mp-grid');
    const players = el('section', 'mp-card'); players.append(el('h3', '', `Drivers · ${room.players.length}/8`));
    for (const player of room.players) {
      const row = el('div', 'mp-player'); const text = el('div');
      const caption = `${player.name}${player.id === this.selfId ? ' (you)' : ''}${player.id === room.ownerId ? ' · HOST' : ''}`;
      text.append(el('strong', '', caption), el('span', 'mp-muted', `${String(player.car).toUpperCase()} · ${!player.connected ? 'Reconnecting' : player.ready ? 'Ready' : 'Not ready'}`));
      row.append(text);
      if (owner && player.id !== this.selfId) row.append(button('Kick', () => this._call('onKick', { playerId: player.id }), 'mp-subtle'));
      players.append(row);
    }
    if (owner && room.pendingRequests?.length) {
      players.append(el('h4', '', 'Waiting for approval'));
      for (const request of room.pendingRequests) {
        const row = el('div', 'mp-request');
        row.append(el('strong', '', request.name), button('Approve', () => this._call('onApprove', { requestId: request.id, accept: true })), button('Reject', () => this._call('onApprove', { requestId: request.id, accept: false }), 'mp-subtle'));
        players.append(row);
      }
    }
    const settings = el('section', 'mp-card'); settings.append(el('h3', '', 'Session settings'));
    const form = this.configForm = el('form', 'mp-form'); this._configFields(form, this.configDraft || room.config);
    const editable = owner && (room.phase === 'lobby' || room.config.mode === 'free');
    this.configEditable = editable;
    for (const input of form.querySelectorAll('select')) input.disabled = !editable || (input.name === 'laps' && form.elements.mode.value === 'free');
    // Mode changes must enable race laps when the host switches from free drive.
    form.elements.mode.addEventListener('change', () => { form.elements.laps.disabled = !editable || form.elements.mode.value === 'free'; });
    if (editable) form.append(button('Apply settings', () => this._call('onConfigure', { ...values(form), laps: Number(form.elements.laps.value) })));
    form.addEventListener('submit', event => event.preventDefault()); settings.append(form);
    if (!owner) settings.append(el('p', 'mp-muted', 'The host controls session settings.'));
    grid.append(players, settings); this.content.append(grid);
    this.standings = el('div', 'mp-standings'); this.content.append(this.standings);
    const actions = el('div', 'mp-actions');
    if (room.config.mode === 'race' && room.phase === 'lobby') {
      const ready = button(self?.ready ? 'Unready' : 'Ready to race', () => this._call('onReady', { ready: !self?.ready }));
      ready.setAttribute('aria-pressed', String(!!self?.ready)); actions.append(ready);
      if (owner) {
        const start = button('Start race', () => this._call('onStart'), 'mp-primary');
        start.disabled = room.players.length < 2 || !room.players.every(player => player.connected && player.ready);
        actions.append(start);
      }
    }
    if (owner && room.config.mode === 'race' && room.phase !== 'lobby') actions.append(button(room.phase === 'finished' ? 'Rematch / return to lobby' : 'Cancel race', () => this._call('onCancel')));
    actions.append(button('Enter track ↗', () => this._call('onEnter'), 'mp-primary'), button('Leave lobby', () => this._call('onLeave'), 'mp-subtle'));
    this.content.append(actions);
    if (room.config.mode === 'race' && room.phase === 'lobby') this.content.append(el('p', 'mp-muted', 'At least two drivers are needed. Every listed driver must be connected and ready before the host starts the countdown. Wait for reconnecting drivers or remove them from the lobby.'));
  }
  _phaseText(state) {
    if (!this.phase) return;
    const config = this.room?.config;
    this.phase.textContent = state.phase === 'countdown' ? `Starting in ${Math.max(0, Math.ceil((state.countdownEndsAt - Date.now()) / 1000))}s · Grid locked` : state.phase === 'finished' ? 'Race finished · Results are in' : state.phase === 'running' ? (config?.mode === 'free' ? 'Free Drive · Track is open' : 'Race in progress') : 'In the paddock · Get ready';
  }
  setStandings(snapshot) {
    if (!this.room || snapshot.code !== this.room.code) return;
    this._phaseText(snapshot);
    if (!this.standings || !snapshot.standings?.length) return;
    this.standings.replaceChildren();
    if (this.room.config.mode !== 'race') return;
    this.standings.append(el('h4', '', snapshot.phase === 'finished' ? 'Race results' : 'Live standings'));
    for (const driver of snapshot.standings) {
      const row = el('div', 'mp-standing');
      row.append(el('strong', '', `${driver.position}. ${driver.name}`), el('span', '', driver.finished && Number.isFinite(driver.time) ? `Finished · ${driver.time.toFixed(2)}s` : `Lap ${Math.min(this.room.config.laps, driver.lap + 1)} / ${this.room.config.laps}`));
      this.standings.append(row);
    }
  }
}
