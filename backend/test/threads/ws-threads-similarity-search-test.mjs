import { io } from 'socket.io-client';

// ─── Configuration ────────────────────────────────────────────────────────────
const BASE_URL  = 'http://localhost:3000/threads';
const TOKEN     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMWNhZjAwMi1hNzNhLTRjNjktODMyYy05NDM4MjFmNWQ2YzciLCJyb2xlIjoiU1RVREVOVCIsInRva2VuVHlwZSI6ImFjY2VzcyIsImlhdCI6MTc3Mzk0ODI0MiwiZXhwIjoxNzczOTUxODQyfQ.fU3QUEZ6hr11no8qliCqZOksJX1XhSL0NGmfOu1_JvE';
const PANEL     = 'ACADEMIC';
// ──────────────────────────────────────────────────────────────────────────────

function onceWithTimeout(socket, event, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timeout waiting for event: ${event}`));
    }, timeoutMs);
    const onEvent = (payload) => {
      clearTimeout(timer);
      resolve(payload);
    };
    socket.once(event, onEvent);
  });
}

function connectClient(token) {
  const socket = io(BASE_URL, {
    transports: ['websocket'],
    auth: { token },
    query: { token },
    forceNew: true,
  });
  socket.on('connect', () => console.log(`Connected: ${socket.id}`));
  socket.on('disconnect', (reason) => console.log(`Disconnected: ${reason}`));
  socket.on('error', (err) => console.log(`Error:`, err));
  return socket;
}

function waitForConnect(socket, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    if (socket.connected) return resolve(true);
    const timer = setTimeout(() => reject(new Error('Timeout waiting for connect')), timeoutMs);
    socket.once('connect', () => { clearTimeout(timer); resolve(true); });
    socket.once('connect_error', (err) => { clearTimeout(timer); reject(new Error(`connect_error: ${err?.message}`)); });
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const socket = connectClient(TOKEN);

  try {
    await waitForConnect(socket);
    console.log('\n─── Thread Similarity Smoke Test ───\n');

    // Test 1 — Related query
    console.log('Test 1: Related query — should return results...');
    const p1 = onceWithTimeout(socket, 'threads:similarity-results');
    socket.emit('threads:typing-similarity', {
      query: 'How to study well for System Theory?',
      panel: PANEL,
    });
    const { results: r1 } = await p1;
    console.log(`Results (${r1.length}):`);
    r1.forEach((r) => console.log(`  [${(r.similarityScore * 100).toFixed(1)}%] ${r.title}`));
    if (r1.length === 0) console.warn('  WARNING: Expected results but got none');

    await wait(500);

    // Test 2 — Short query under 10 chars
    console.log('\nTest 2: Short query — should return empty...');
    const p2 = onceWithTimeout(socket, 'threads:similarity-results');
    socket.emit('threads:typing-similarity', { query: 'CS exam', panel: PANEL });
    const { results: r2 } = await p2;
    r2.length === 0
      ? console.log('  Short query correctly returned no results')
      : console.warn(`  WARNING: Expected empty but got ${r2.length} results`);

    await wait(500);

    // Test 3 — Unrelated query
    console.log('\nTest 3: Unrelated query — should return no results...');
    const p3 = onceWithTimeout(socket, 'threads:similarity-results');
    socket.emit('threads:typing-similarity', {
      query: 'What is the best pizza topping recipe?',
      panel: PANEL,
    });
    const { results: r3 } = await p3;
    r3.length === 0
      ? console.log('  Unrelated query correctly returned no results')
      : console.log(`  Got ${r3.length} results: ${r3.map(r => `[${(r.similarityScore * 100).toFixed(1)}%] ${r.title}`).join(', ')}`);

    await wait(500);

    // Test 4 — Near duplicate
    console.log('\nTest 4: Near-duplicate query — should return high similarity...');
    const p4 = onceWithTimeout(socket, 'threads:similarity-results');
    socket.emit('threads:typing-similarity', {
      query: 'How should I prepare for my CS101 midterm?',
      panel: PANEL,
    });
    const { results: r4 } = await p4;
    console.log(`Results (${r4.length}):`);
    r4.forEach((r) => console.log(`  [${(r.similarityScore * 100).toFixed(1)}%] ${r.title}`));
    if (r4.length > 0 && r4[0].similarityScore >= 0.75) {
      console.log('  High similarity match found as expected');
    } else {
      console.warn('  WARNING: Expected high similarity match');
    }

    console.log('\nAll similarity tests completed.');

  } finally {
    socket.disconnect();
  }

}

main().catch((err) => {
  console.error('Similarity test failed:', err.message);
  process.exit(1);
});