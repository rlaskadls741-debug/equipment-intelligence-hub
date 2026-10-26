const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {randomUUID} = require('node:crypto');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('    let metricDbPromise=');
const end = html.indexOf('    async function metricRequest(', start);
assert.ok(start > 0 && end > start, 'visitor identity implementation must exist');
const source = html.slice(start, end);

// Model the IndexedDB guarantee used by the page: readwrite transactions on
// the same store run serially, including writes scheduled in get.onsuccess.
class BrowserStorage {
  constructor() { this.state = new Map(); this.local = new Map(); this.queue = []; this.active = false; }
  transaction() {
    const operations = [];
    const tx = {
      objectStore: () => ({
        get: key => { const request = {}; operations.push(() => { request.result = this.state.get(key); request.onsuccess?.(); }); return request; },
        put: (value, key) => operations.push(() => this.state.set(key, value))
      })
    };
    this.queue.push({tx, operations});
    queueMicrotask(() => this.drain());
    return tx;
  }
  drain() {
    if (this.active || !this.queue.length) return;
    this.active = true;
    const {tx, operations} = this.queue.shift();
    try {
      while (operations.length) operations.shift()();
      tx.oncomplete?.();
    } catch (error) { tx.error = error; tx.onabort?.(); }
    this.active = false;
    queueMicrotask(() => this.drain());
  }
}
function openTab(storage, options = {}) {
  const context = vm.createContext({
    crypto: {randomUUID},
    indexedDB: options.blocked ? undefined : {
      open: () => {
        const request = {result: storage};
        queueMicrotask(() => request.onsuccess?.());
        return request;
      }
    },
    localStorage: {
      getItem: key => storage.local.get(key) ?? null,
      setItem: (key, value) => storage.local.set(key, value)
    }
  });
  return vm.runInContext(source + '\n({stableVisitorId, metricState});', context);
}

test('twenty concurrent first requests use one persisted visitor identity', async () => {
  const storage = new BrowserStorage(), tab = openTab(storage);
  const ids = await Promise.all(Array.from({length: 20}, () => tab.stableVisitorId()));
  assert.equal(new Set(ids).size, 1);
  assert.equal(storage.state.get('visitorId'), ids[0]);
});
test('twenty independent tabs starting together use one visitor identity', async () => {
  const storage = new BrowserStorage();
  const ids = await Promise.all(Array.from({length: 20}, () => openTab(storage).stableVisitorId()));
  assert.equal(new Set(ids).size, 1);
  assert.equal(storage.state.get('visitorId'), ids[0]);
});
test('reloads and repeated requests keep the same identity', async () => {
  const storage = new BrowserStorage();
  const id = await openTab(storage).stableVisitorId();
  for (let n = 0; n < 5; n++) assert.equal(await openTab(storage).stableVisitorId(), id);
});
test('an existing IndexedDB identity wins over a different backup', async () => {
  const storage = new BrowserStorage(), id = 'eh-' + randomUUID();
  storage.state.set('visitorId', id);
  storage.local.set('equipmentHubVisitorIdV1', 'eh-' + randomUUID());
  assert.equal(await openTab(storage).stableVisitorId(), id);
  assert.equal(storage.local.get('equipmentHubVisitorIdV1'), id);
});
test('a valid backup restores an empty IndexedDB without changing identity', async () => {
  const storage = new BrowserStorage(), id = 'eh-' + randomUUID();
  storage.local.set('equipmentHubVisitorIdV1', id);
  const ids = await Promise.all(Array.from({length: 10}, () => openTab(storage).stableVisitorId()));
  assert.ok(ids.every(value => value === id));
  assert.equal(storage.state.get('visitorId'), id);
});
test('separate browsers receive different visitor identities', async () => {
  const [a, b] = await Promise.all([openTab(new BrowserStorage()).stableVisitorId(), openTab(new BrowserStorage()).stableVisitorId()]);
  assert.notEqual(a, b);
});
test('unavailable persistent storage fails without issuing temporary identities', async () => {
  const storage = new BrowserStorage(), tab = openTab(storage, {blocked: true});
  await assert.rejects(tab.stableVisitorId(), /브라우저 저장소 사용 불가/);
  await assert.rejects(tab.stableVisitorId(), /브라우저 저장소 사용 불가/);
  assert.equal(storage.state.size, 0);
  assert.equal(storage.local.size, 0);
});
