import { io } from 'socket.io-client';

// ─── Configuration ────────────────────────────────────────────────────────────
// Fill these in before running
// Get tokens by logging in via threads.http

const BASE_URL    = 'http://localhost:3000/threads';
const API_BASE    = 'http://localhost:3000';
const THREAD_ID   = 'azmy18gj9';
const USER1_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmYjczN2YzYi05NTk1LTQ1ZWYtOTU5Ni03MGRiNmYxNzBlYTMiLCJyb2xlIjoiU1RVREVOVCIsInRva2VuVHlwZSI6ImFjY2VzcyIsImlhdCI6MTc3MzkzMTEzNSwiZXhwIjoxNzczOTM0NzM1fQ.rwp4MIve8XjE1mO1b6K7Q8N_ZG7lA6FMemcotdZg2x4';
const USER2_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI5OWRhNzdlYi1jZTZjLTQ0YTQtOGVmMS0wNGVlYjFhOGYwNTAiLCJyb2xlIjoiU1RVREVOVCIsInRva2VuVHlwZSI6ImFjY2VzcyIsImlhdCI6MTc3MzkzMTE1NSwiZXhwIjoxNzczOTM0NzU1fQ.-Fzh03Zl8ue-DCcJpRECxgjv6r2zJmJFZAHGD3CbzWI';
// ──────────────────────────────────────────────────────────────────────────────

if (!THREAD_ID) {
  console.error('Fill in THREAD_ID and tokens at the top of this file before running.');
  process.exit(1);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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
    auth: { token },
    query: { token },
    forceNew: true,
  });

  socket.on('connect', () => console.log(`[${name}] connected: ${socket.id}`));
  socket.on('disconnect', (reason) => console.log(`[${name}] disconnected: ${reason}`));
  socket.on('error', (err) => console.log(`[${name}] error:`, err));

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

function joinThread(name, socket, threadId) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`[${name}] timeout waiting for threads:joined`));
    }, 5000);

    const onJoined = (payload) => {
      cleanup();
      console.log(`[${name}] joined payload:`, payload);
      resolve(payload);
    };

    const onError = (err) => {
      cleanup();
      reject(new Error(`[${name}] join rejected: ${err?.message || JSON.stringify(err)}`));
    };

    const cleanup = () => {
      clearTimeout(timer);
      socket.off('threads:joined', onJoined);
      socket.off('error', onError);
    };

    socket.once('threads:joined', onJoined);
    socket.once('error', onError);
    socket.emit('threads:join', { threadId });
  });
}

// ─── REST helpers ─────────────────────────────────────────────────────────────

async function postReplyViaRest(threadId, content, token) {
  const res = await fetch(`${API_BASE}/threads/${threadId}/replies`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`postReply REST failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  return data.reply;
}

async function editReplyViaRest(threadId, replyId, content, token) {
  const res = await fetch(`${API_BASE}/threads/${threadId}/replies/${replyId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`editReply REST failed (${res.status}): ${body}`);
  }
}

async function deleteReplyViaRest(threadId, replyId, token) {
  const res = await fetch(`${API_BASE}/threads/${threadId}/replies/${replyId}/delete`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`deleteReply REST failed (${res.status}): ${body}`);
  }
}

async function voteThreadViaRest(threadId, voteType, token) {
  const res = await fetch(`${API_BASE}/threads/${threadId}/vote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ voteType }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`voteThread REST failed (${res.status}): ${body}`);
  }
}

async function voteReplyViaRest(threadId, replyId, voteType, token) {
  const res = await fetch(`${API_BASE}/threads/${threadId}/replies/${replyId}/vote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ voteType }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`voteReply REST failed (${res.status}): ${body}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const user1 = connectClient('user1', USER1_TOKEN);
  const user2 = connectClient('user2', USER2_TOKEN);

  try {
    await Promise.all([
      waitForConnect('user1', user1),
      waitForConnect('user2', user2),
    ]);

    // 1) Both users join the thread room
    await joinThread('user1', user1, THREAD_ID);
    await joinThread('user2', user2, THREAD_ID);
    console.log('\n[1] Both users joined thread room OK');

    // 2) Reply posted broadcast — user1 posts, user2 should receive
    const replyBroadcastPromise = onceWithTimeout(user2, 'threads:reply-posted');
    const reply = await postReplyViaRest(THREAD_ID, 'Hello from user1!', USER1_TOKEN);
    const replyEvent = await replyBroadcastPromise;
    console.log('\n[2] Reply posted broadcast OK — user2 got:', replyEvent);

    await wait(300);

    // 3) Reply edited broadcast — user1 edits, user2 should receive
    const editBroadcastPromise = onceWithTimeout(user2, 'threads:reply-edited');
    await editReplyViaRest(THREAD_ID, reply.id, 'Edited: Hello from user1!', USER1_TOKEN);
    const editEvent = await editBroadcastPromise;
    console.log('\n[3] Reply edited broadcast OK — user2 got:', editEvent);

    await wait(300);

    // 4) Thread vote broadcast — user2 upvotes, user1 should receive
    const threadVoteBroadcastPromise = onceWithTimeout(user1, 'threads:thread-voted');
    await voteThreadViaRest(THREAD_ID, 'UPVOTE', USER2_TOKEN);
    const threadVoteEvent = await threadVoteBroadcastPromise;
    console.log('\n[4] Thread vote broadcast OK — user1 got:', threadVoteEvent);

    await wait(300);

    // 5) Reply vote broadcast — user2 upvotes reply, user1 should receive
    const replyVoteBroadcastPromise = onceWithTimeout(user1, 'threads:reply-voted');
    await voteReplyViaRest(THREAD_ID, reply.id, 'UPVOTE', USER2_TOKEN);
    const replyVoteEvent = await replyVoteBroadcastPromise;
    console.log('\n[5] Reply vote broadcast OK — user1 got:', replyVoteEvent);

    await wait(300);

    // 6) Reply deleted broadcast — user1 deletes, user2 should receive
    const deleteBroadcastPromise = onceWithTimeout(user2, 'threads:reply-deleted');
    await deleteReplyViaRest(THREAD_ID, reply.id, USER1_TOKEN);
    const deleteEvent = await deleteBroadcastPromise;
    console.log('\n[6] Reply deleted broadcast OK — user2 got:', deleteEvent);

    await wait(300);

    // 7) Presence test — user1 leaves, user2 should get presence event
    const presencePromise = onceWithTimeout(user2, 'threads:presence');
    user1.emit('threads:leave', { threadId: THREAD_ID });
    const presenceEvent = await presencePromise;
    console.log('\n[7] Presence broadcast OK — user2 got:', presenceEvent);

    console.log('\nAll thread WebSocket smoke tests passed.');

  } finally {
    user1.disconnect();
    user2.disconnect();
  }
}

main().catch((err) => {
  console.error('Thread WebSocket smoke test failed:', err.message);
  process.exit(1);
});