import test from 'node:test';
import assert from 'node:assert/strict';
import { LobbyClient } from '../src/multiplayer/client.js';

class Socket extends EventTarget {
  static OPEN = 1;
  static instances = [];
  constructor(url) { super(); this.url = url; this.readyState = 0; this.sent = []; Socket.instances.push(this); }
  open() { this.readyState = 1; this.dispatchEvent(new Event('open')); }
  receive(data) { const event = new Event('message'); event.data = data; this.dispatchEvent(event); }
  send(data) { this.sent.push(JSON.parse(data)); }
  close() { this.readyState = 3; this.dispatchEvent(new Event('close')); }
}

test('transport joins, filters invalid data, measures ping and deliberately disconnects', async () => {
  const original = globalThis.WebSocket; globalThis.WebSocket = Socket;
  const client = new LobbyClient('ws://example.test');
  try {
    const messages = []; client.addEventListener('message', event => messages.push(event.detail));
    const connecting = client.connect(); const socket = Socket.instances.at(-1);
    socket.open(); await connecting;
    assert.equal(client.connected, true);
    assert.equal(socket.sent[0].type, 'ping');
    socket.receive('invalid'); socket.receive('null'); socket.receive('[]');
    socket.receive(JSON.stringify({ type: 'joined', token: 'private-secret', selfId: 'one' }));
    socket.receive(JSON.stringify({ type: 'pong', clientTime: Date.now() - 10 }));
    assert.equal(messages.length, 2); assert.ok(client.latency >= 10);
    assert.equal(client.send({ type: 'ready', ready: true }), true);
    client.disconnect();
    assert.equal(client.connected, false); assert.equal(client._token, null);
    assert.equal(client._retry, null); assert.equal(client.send({ type: 'list' }), false);
  } finally { client.disconnect(); globalThis.WebSocket = original; }
});

test('transient disconnect resumes membership without putting secret in URL', async () => {
  const original = globalThis.WebSocket; globalThis.WebSocket = Socket;
  const client = new LobbyClient('ws://example.test');
  try {
    let connecting = client.connect(); Socket.instances.at(-1).open(); await connecting;
    client.setResumeToken('private-secret'); Socket.instances.at(-1).close();
    assert.ok(client._retry); assert.equal(client.connected, false);
    // Explicit connect performs the same pending recovery immediately.
    connecting = client.connect(); const resumed = Socket.instances.at(-1); resumed.open(); await connecting;
    assert.equal(resumed.url, 'ws://example.test');
    assert.deepEqual(resumed.sent[0], { type: 'resume', token: 'private-secret' });
    resumed.receive(JSON.stringify({ type: 'left' }));
    resumed.close(); assert.equal(client._retry, null);
  } finally { client.disconnect(); globalThis.WebSocket = original; }
});
