import { io } from 'socket.io-client';

// ─── Configuration ────────────────────────────────────────────────────────────
const BASE_URL  = 'http://localhost:3000/notes';
const TOKEN     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMWNhZjAwMi1hNzNhLTRjNjktODMyYy05NDM4MjFmNWQ2YzciLCJyb2xlIjoiU1RVREVOVCIsInRva2VuVHlwZSI6ImFjY2VzcyIsImlhdCI6MTc3NDAwMTM1MywiZXhwIjoxNzc0MDA0OTUzfQ.dP4SFddliw9uU-vA30T7-WOhhedJqn7eqUo87rncnPc';
const NOTE_ID   = '9jztextea';
// ──────────────────────────────────────────────────────────────────────────────

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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

function joinNote(socket, noteId) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for notes:joined')), 5000);
    socket.once('notes:joined', (payload) => { clearTimeout(timer); resolve(payload); });
    socket.once('error', (err) => { clearTimeout(timer); reject(new Error(err?.message)); });
    socket.emit('notes:join', { noteId });
  });
}

async function main() {
  const socket = connectClient(TOKEN);

  try {
    await waitForConnect(socket);
    await joinNote(socket, NOTE_ID);
    console.log('\n─── Notes Related Threads Smoke Test ───\n');

    // Test 1 — Short content, should return empty
    console.log('Test 1: Short content — should return empty...');
    const p1 = onceWithTimeout(socket, 'notes:related-threads');
    socket.emit('notes:typing-related-threads', {
      noteId: NOTE_ID,
      title: 'Hi',
      contentJson: null,
    });
    const { results: r1 } = await p1;
    r1.length === 0
      ? console.log('  Short content correctly returned no results')
      : console.warn(`  WARNING: Expected empty but got ${r1.length} results`);

    await wait(500);

    // Test 2 — Unrelated content, should return empty
    console.log('\nTest 2: Unrelated content — should return no results...');
    const p2 = onceWithTimeout(socket, 'notes:related-threads');
    socket.emit('notes:typing-related-threads', {
      noteId: NOTE_ID,
      title: 'My favourite pizza recipes',
      contentJson: {
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: 'Margherita pizza with fresh basil and mozzarella is the best pizza topping combination ever made.' }]
        }]
      },
    });
    const { results: r2 } = await p2;
    r2.length === 0
      ? console.log('  Unrelated content correctly returned no results')
      : console.log(`  Got ${r2.length} results: ${r2.map(r => `[${(r.similarityScore * 100).toFixed(1)}%] ${r.title}`).join(', ')}`);

    await wait(500);

    // Test 3 — Related content, should return thread results
    console.log('\nTest 3: Related content — should return thread results...');
    const p3 = onceWithTimeout(socket, 'notes:related-threads');
    socket.emit('notes:typing-related-threads', {
      noteId: NOTE_ID,
      title: 'CS101 Exam Preparation',
      contentJson: {
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: 'Preparing for the CS101 midterm exam. Key topics include algorithms, data structures, and programming concepts. Need to review past papers and lecture notes before the exam.' }]
        }]
      },
    });
    const { results: r3 } = await p3;
    console.log(`Results (${r3.length}):`);
    r3.forEach((r) => console.log(`  [${(r.similarityScore * 100).toFixed(1)}%] ${r.title} — ${r.replyCount} replies`));
    if (r3.length === 0) console.warn('  WARNING: Expected results but got none');

    await wait(500);

    // Test 4 — System Theory content matching existing thread
    console.log('\nTest 4: System Theory content — should match existing thread...');
    const p4 = onceWithTimeout(socket, 'notes:related-threads');
    socket.emit('notes:typing-related-threads', {
      noteId: NOTE_ID,
      title: 'System Theory Revision',
      contentJson: {
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: 'Studying for the System Theory exam. Need to understand control systems, transfer functions, and frequency response analysis for the practical midterm.' }]
        }]
      },
    });
    const { results: r4 } = await p4;
    console.log(`Results (${r4.length}):`);
    r4.forEach((r) => console.log(`  [${(r.similarityScore * 100).toFixed(1)}%] ${r.title} — ${r.replyCount} replies`));
    if (r4.length === 0) console.warn('  WARNING: Expected System Theory thread to match');

    console.log('\nAll related threads tests completed.');

  } finally {
    socket.disconnect();
  }
}

main().catch((err) => {
  console.error('Related threads test failed:', err.message);
  process.exit(1);
});