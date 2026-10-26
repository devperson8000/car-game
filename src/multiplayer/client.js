/** Small protocol transport; membership secrets are kept only in memory. */
export class LobbyClient extends EventTarget {
  constructor(url) {
    super();
    this.url = url;
    this.connected = false;
    this.latency = null;
    this._token = null;
    this._socket = null;
    this._intentional = true;
    this._attempt = 0;
    this._retry = null;
    this._ping = null;
    this._pendingConnect = null;
    this._generation = 0;
  }
  _emit(type, detail) {
    const event = new Event(type);
    Object.defineProperty(event, 'detail', { value: detail });
    this.dispatchEvent(event);
  }
  _status(state, message) { this._emit('status', { state, ...(message ? { message } : {}) }); }
  setResumeToken(token) {
    this._token = typeof token === 'string' && token ? token : null;
    if (!this._token) { clearTimeout(this._retry); this._retry = null; }
  }
  connect() {
    if (this.connected) return Promise.resolve();
    if (this._pendingConnect) return this._pendingConnect.promise;
    clearTimeout(this._retry);
    this._retry = null;
    this._intentional = false;
    return this._open(false);
  }
  _open(reconnecting) {
    this._status(reconnecting ? 'reconnecting' : 'connecting');
    const generation = ++this._generation;
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    this._pendingConnect = { promise, reject };
    let socket;
    try { socket = new WebSocket(this.url); }
    catch {
      this._pendingConnect = null;
      this._status('disconnected', 'Live multiplayer is unavailable. Try again shortly.');
      reject(new Error('Unable to connect to live multiplayer.'));
      this._scheduleReconnect();
      return promise;
    }
    this._socket = socket;
    const timeout = setTimeout(() => { if (!this.connected) socket.close(); }, 10000);
    socket.addEventListener('open', () => {
      if (generation !== this._generation || this._intentional) return;
      clearTimeout(timeout);
      this.connected = true;
      this._attempt = 0;
      this._pendingConnect = null;
      if (this._token) this.send({ type: 'resume', token: this._token });
      this._status('connected');
      resolve();
      this._sendPing();
      this._ping = setInterval(() => this._sendPing(), 5000);
    });
    socket.addEventListener('message', event => {
      if (generation !== this._generation || typeof event.data !== 'string' || event.data.length > 1000000) return;
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (!message || typeof message !== 'object' || Array.isArray(message) || typeof message.type !== 'string') return;
      if (message.type === 'joined' && typeof message.token === 'string') this.setResumeToken(message.token);
      if (message.type === 'left' || message.type === 'rejected') this.setResumeToken(null);
      if (message.type === 'pong' && Number.isFinite(message.clientTime)) {
        const elapsed = Date.now() - message.clientTime;
        if (elapsed >= 0 && elapsed < 60000) this.latency = Math.round(elapsed);
      }
      this._emit('message', message);
    });
    socket.addEventListener('error', () => { /* close provides the single sanitized error path */ });
    socket.addEventListener('close', () => {
      clearTimeout(timeout);
      if (generation !== this._generation) return;
      clearInterval(this._ping);
      this._ping = null;
      this.connected = false;
      this._socket = null;
      this._pendingConnect = null;
      reject(new Error('Connection to live multiplayer was interrupted.'));
      if (!this._intentional && this._token) this._scheduleReconnect();
      else this._status('disconnected', this._intentional ? undefined : 'Live multiplayer disconnected. Reopen to try again.');
    });
    return promise;
  }
  _scheduleReconnect() {
    if (this._intentional || !this._token || this._retry) return;
    if (this._attempt >= 8) {
      this._status('disconnected', 'Unable to reconnect. Reopen multiplayer to try again.');
      return;
    }
    const delay = Math.min(500 * 2 ** this._attempt++, 4000);
    this._status('reconnecting', 'Connection interrupted. Reconnecting…');
    this._retry = setTimeout(() => {
      this._retry = null;
      if (!this._intentional && this._token) this._open(true).catch(() => {});
    }, delay);
  }
  _sendPing() { this.send({ type: 'ping', clientTime: Date.now() }); }
  send(message) {
    if (!this.connected || this._socket?.readyState !== WebSocket.OPEN) return false;
    try { this._socket.send(JSON.stringify(message)); return true; }
    catch { return false; }
  }
  disconnect() {
    this._intentional = true;
    this._token = null;
    this._attempt = 0;
    clearTimeout(this._retry);
    clearInterval(this._ping);
    this._retry = this._ping = null;
    this._pendingConnect?.reject(new Error('Multiplayer connection closed.'));
    this._pendingConnect = null;
    ++this._generation;
    const socket = this._socket;
    this._socket = null;
    this.connected = false;
    this.latency = null;
    socket?.close();
    this._status('disconnected');
  }
}
