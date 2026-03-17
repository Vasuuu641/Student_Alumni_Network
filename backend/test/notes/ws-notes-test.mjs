import { io } from 'socket.io-client';

// ─── Configuration ────────────────────────────────────────────────────────────
// Fill these in directly (same as setting @token in .http files)
// Get tokens by logging in via test/notes/notes-login.http

const BASE_URL = 'http://localhost:3000/notes';
const API_BASE_URL = 'http://localhost:3000';
const NOTE_ID   = 'hl7ukykf2';
const OWNER_TOKEN  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmYjczN2YzYi05NTk1LTQ1ZWYtOTU5Ni03MGRiNmYxNzBlYTMiLCJyb2xlIjoiU1RVREVOVCIsInRva2VuVHlwZSI6ImFjY2VzcyIsImlhdCI6MTc3MzM4ODcxMCwiZXhwIjoxNzczMzkyMzEwfQ.U3LRvptcRR3Kx3a9ouDqvF0DobDmrJhw_d3c00R0nck';
const EDITOR_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI5OWRhNzdlYi1jZTZjLTQ0YTQtOGVmMS0wNGVlYjFhOGYwNTAiLCJyb2xlIjoiU1RVREVOVCIsInRva2VuVHlwZSI6ImFjY2VzcyIsImlhdCI6MTc3MzM4ODY4NSwiZXhwIjoxNzczMzkyMjg1fQ.KsW9UYmx0TseDver0T-BUdJDTWp0YhptpD8XTi06gdo';
const VIEWER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkNWEwNmM2OS0wMGJlLTQ4ODItYTFkMi03ZWE2ZTVlOGRlMDIiLCJyb2xlIjoiUFJPRkVTU09SIiwidG9rZW5UeXBlIjoiYWNjZXNzIiwiaWF0IjoxNzczMzg5MDE4LCJleHAiOjE3NzMzOTI2MTh9.1A6WYIacK9Tms7YhBW1VlBNLe3sP50YLJZ1RM5yjhvg'; // optional - leave empty string to skip viewer tests
// ──────────────────────────────────────────────────────────────────────────────

if (!NOTE_ID || !OWNER_TOKEN || !EDITOR_TOKEN) {
  console.error('Fill in NOTE_ID, OWNER_TOKEN, and EDITOR_TOKEN at the top of this file before running.');
  process.exit(1);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function createCheckpointViaRest(noteId, token) {
  const response = await fetch(`${API_BASE_URL}/notes/${noteId}/versions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`checkpoint REST failed (${response.status}): ${body}`);
  }
}

function onceWithTimeout(socket, event, timeoutMs = 4000) {
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

function connectClient(name, token) {
  const socket = io(BASE_URL, {
    transports: ['websocket'],
    query: { token },
    extraHeaders: {
      authorization: `Bearer ${token}`,
    },
    forceNew: true,
  });

  socket.on('connect', () => {
    console.log(`[${name}] connected: ${socket.id}`);
  });

  socket.on('disconnect', (reason) => {
    console.log(`[${name}] disconnected: ${reason}`);
  });

  socket.on('error', (err) => {
    console.log(`[${name}] error event:`, err);
  });

  return socket;
}

function waitForConnect(name, socket, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    if (socket.connected) return resolve(true);

    const timer = setTimeout(() => {
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
      reject(new Error(`[${name}] timeout waiting for connect`));
    }, timeoutMs);

    const onConnect = () => {
      clearTimeout(timer);
      socket.off('connect_error', onConnectError);
      resolve(true);
    };

    const onConnectError = (err) => {
      clearTimeout(timer);
      socket.off('connect', onConnect);
      reject(new Error(`[${name}] connect_error: ${err?.message || 'unknown'}`));
    };

    socket.once('connect', onConnect);
    socket.once('connect_error', onConnectError);
  });
}

async function joinNote(name, socket, noteId) {
  return new Promise((resolve, reject) => {
    const timeoutMs = 5000;
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`[${name}] timeout waiting for notes:joined`));
    }, timeoutMs);

    const onJoined = (payload) => {
      cleanup();
      console.log(`[${name}] joined payload:`, payload);
      resolve(payload);
    };

    const onError = (err) => {
      cleanup();
      reject(
        new Error(
          `[${name}] join rejected: ${err?.message || JSON.stringify(err)}`,
        ),
      );
    };

    const cleanup = () => {
      clearTimeout(timer);
      socket.off('notes:joined', onJoined);
      socket.off('error', onError);
    };

    socket.once('notes:joined', onJoined);
    socket.once('error', onError);
    socket.emit('notes:join', { noteId });
  });
}

async function main() {
  const owner = connectClient('owner', OWNER_TOKEN);
  const editor = connectClient('editor', EDITOR_TOKEN);
  const viewer = VIEWER_TOKEN ? connectClient('viewer', VIEWER_TOKEN) : null;

  try {
    await Promise.all([
      waitForConnect('owner', owner),
      waitForConnect('editor', editor),
      viewer ? waitForConnect('viewer', viewer) : Promise.resolve(null),
    ]);

    // 1) Join room and verify roles
    const ownerJoin = await joinNote('owner', owner, NOTE_ID);
    const editorJoin = await joinNote('editor', editor, NOTE_ID);

    if (!ownerJoin.canEdit) throw new Error('Owner should have canEdit=true');
    if (!editorJoin.canEdit) console.warn('[editor] canEdit=false (editor token might actually be viewer)');

    if (viewer) {
      const viewerJoin = await joinNote('viewer', viewer, NOTE_ID);
      if (viewerJoin.canEdit) {
        console.warn('[viewer] canEdit=true (viewer token likely has editor/owner access)');
      }
    }

    // 2) Awareness relay test (editor -> owner)
    const awarenessPromise = onceWithTimeout(owner, 'notes:awareness');
    editor.emit('notes:awareness', {
      noteId: NOTE_ID,
      awarenessState: { cursor: { from: 1, to: 1 }, user: 'editor' },
    });
    const awareness = await awarenessPromise;
    console.log('[awareness relay OK] owner got:', awareness);

    // 3) CRDT relay test (owner -> editor)
    const crdtPromise = onceWithTimeout(editor, 'notes:crdt-update');
    owner.emit('notes:crdt-update', {
      noteId: NOTE_ID,
      update: { ops: [{ insert: 'hello from owner' }], ts: Date.now() },
    });
    const crdt = await crdtPromise;
    console.log('[crdt relay OK] editor got:', crdt);

    // 4) Viewer edit denial test (if viewer token provided)
    if (viewer) {
      const errPromise = onceWithTimeout(viewer, 'error');
      viewer.emit('notes:crdt-update', {
        noteId: NOTE_ID,
        update: { ops: [{ insert: 'viewer should fail' }] },
      });
      const err = await errPromise;
      console.log('[viewer denial OK] viewer got error:', err);
    }

    // 5) Checkpoint broadcast test (REST -> WS event)
    const checkpointBroadcastPromise = onceWithTimeout(
      editor,
      'notes:checkpoint-created',
    );
    await createCheckpointViaRest(NOTE_ID, OWNER_TOKEN);
    const checkpointEvent = await checkpointBroadcastPromise;
    console.log('[checkpoint broadcast OK] editor got:', checkpointEvent);

    // 6) Leave test
    owner.emit('notes:leave', { noteId: NOTE_ID });
    editor.emit('notes:leave', { noteId: NOTE_ID });
    if (viewer) viewer.emit('notes:leave', { noteId: NOTE_ID });

    await wait(400);
    console.log('\nAll websocket smoke tests completed.');
  } finally {
    owner.disconnect();
    editor.disconnect();
    if (viewer) viewer.disconnect();
  }
}

main().catch((err) => {
  console.error('WebSocket smoke test failed:', err.message);
  process.exit(1);
});
