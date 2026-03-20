import { io } from 'socket.io-client';

// ─── Configuration ────────────────────────────────────────────────────────────
const BASE_URL    = 'http://localhost:3000/threads';
const API_BASE    = 'http://localhost:3000';
const THREAD_ID   = 'g2yfmswhc';
const USER1_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMWNhZjAwMi1hNzNhLTRjNjktODMyYy05NDM4MjFmNWQ2YzciLCJyb2xlIjoiU1RVREVOVCIsInRva2VuVHlwZSI6ImFjY2VzcyIsImlhdCI6MTc3NDAwNDYzOSwiZXhwIjoxNzc0MDA4MjM5fQ.oHAjdw_ZE3UwmRKrC1ZjeseHz8kBwTWe1hLDcTWBTyU';
const USER2_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzYTg0YjUxYi0xZGUxLTRhOTAtYWY1Yy0xNThlNzE2MWVhNTgiLCJyb2xlIjoiU1RVREVOVCIsInRva2VuVHlwZSI6ImFjY2VzcyIsImlhdCI6MTc3NDAwNDk3OCwiZXhwIjoxNzc0MDA4NTc4fQ.5MfXg7AjFeA4HQRFn9Sz4VHcIt8Ii-caGl4qs4cuTPo';
// ──────────────────────────────────────────────────────────────────────────────

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function onceWithTimeout(socket, event, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timeout waiting for event: ${event}`));
    }, timeoutMs);
    const onEvent = (payload) => { clearTimeout(timer); resolve(payload); };
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
    const timer = setTimeout(() => reject(new Error(`[${name}] timeout waiting for connect`)), timeoutMs);
    socket.once('connect', () => { clearTimeout(timer); resolve(true); });
    socket.once('connect_error', (err) => { clearTimeout(timer); reject(new Error(`[${name}] connect_error: ${err?.message}`)); });
  });
}

function joinThread(name, socket, threadId) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error(`[${name}] timeout waiting for threads:joined`)); }, 5000);
    const onJoined = (payload) => { cleanup(); console.log(`[${name}] joined thread`); resolve(payload); };
    const onError = (err) => { cleanup(); reject(new Error(`[${name}] join rejected: ${err?.message || JSON.stringify(err)}`)); };
    const cleanup = () => { clearTimeout(timer); socket.off('threads:joined', onJoined); socket.off('error', onError); };
    socket.once('threads:joined', onJoined);
    socket.once('error', onError);
    socket.emit('threads:join', { threadId });
  });
}

// ─── REST helpers ─────────────────────────────────────────────────────────────

async function postReply(threadId, content, token, parentReplyId = null) {
  const body = parentReplyId ? { content, parentReplyId } : { content };
  const res = await fetch(`${API_BASE}/threads/${threadId}/replies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`postReply failed (${res.status}): ${await res.text()}`);
  return (await res.json()).reply;
}

async function editReply(threadId, replyId, content, token) {
  const res = await fetch(`${API_BASE}/threads/${threadId}/replies/${replyId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ content }),
  });
  return { ok: res.ok, status: res.status, body: await res.json() };
}

async function deleteReply(threadId, replyId, token) {
  const res = await fetch(`${API_BASE}/threads/${threadId}/replies/${replyId}/delete`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${token}` },
  });
  return { ok: res.ok, status: res.status };
}

async function voteThread(threadId, voteType, token) {
  const res = await fetch(`${API_BASE}/threads/${threadId}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ voteType }),
  });
  if (!res.ok) throw new Error(`voteThread failed (${res.status}): ${await res.text()}`);
}

async function voteReply(threadId, replyId, voteType, token) {
  const res = await fetch(`${API_BASE}/threads/${threadId}/replies/${replyId}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ voteType }),
  });
  if (!res.ok) throw new Error(`voteReply failed (${res.status}): ${await res.text()}`);
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
    await wait(300);

    // 2) User1 posts — user2 receives broadcast
    console.log('\n[2] User1 posts reply — user2 should receive broadcast...');
    const p2 = onceWithTimeout(user2, 'threads:reply-posted');
    const reply1 = await postReply(THREAD_ID, 'Start with recursion — make sure you understand the base case and recursive case clearly. Draw the call stack on paper for simple examples like factorial and fibonacci before moving to harder problems.', USER1_TOKEN);
    const e2 = await p2;
    console.log(`  user2 received reply-posted: replyId=${e2.reply.id}`);
    await wait(300);

    // 3) User2 posts — user1 receives broadcast
    console.log('\n[3] User2 posts reply — user1 should receive broadcast...');
    const p3 = onceWithTimeout(user1, 'threads:reply-posted');
    const reply2 = await postReply(THREAD_ID, 'For Big O notation — focus on understanding the difference between O(n), O(n log n), O(n²), and O(log n). Know which sorting algorithms correspond to each complexity and why. The exam always has at least one question on this.', USER2_TOKEN);
    const e3 = await p3;
    console.log(`  user1 received reply-posted: replyId=${e3.reply.id}`);
    await wait(300);

    // 4) User1 posts nested reply under user2's reply
    console.log('\n[4] User1 posts nested reply under user2 reply — user2 should receive...');
    const p4 = onceWithTimeout(user2, 'threads:reply-posted');
    const reply1a = await postReply(
      THREAD_ID,
      'Agreed on Big O — also make sure you can analyse nested loops. A loop inside a loop is usually O(n²) unless the inner loop has a fixed bound.',
      USER1_TOKEN,
      reply2.id,
    );
    const e4 = await p4;
    console.log(`  user2 received nested reply-posted: parentReplyId=${reply1a.parentReplyId}`);
    await wait(300);

    // 5) User2 posts nested reply under user1's nested reply
    console.log('\n[5] User2 posts nested reply under user1 nested reply — user1 should receive...');
    const p5 = onceWithTimeout(user1, 'threads:reply-posted');
    const reply2a = await postReply(
      THREAD_ID,
      'Good point. Also worth knowing merge sort is O(n log n) in all cases while quicksort is O(n log n) average but O(n²) worst case. The professor asked about this last year.',
      USER2_TOKEN,
      reply1a.id,
    );
    const e5 = await p5;
    console.log(`  user1 received deep nested reply-posted: parentReplyId=${reply2a.parentReplyId}`);
    await wait(300);

    // 6) User1 edits their own reply
    console.log('\n[6] User1 edits their reply — user2 should receive broadcast...');
    const p6 = onceWithTimeout(user2, 'threads:reply-edited');
    await editReply(THREAD_ID, reply1.id, 'Start with recursion — understand the base case and recursive case. Draw the call stack for factorial, fibonacci, and binary search. The exam usually has one recursive function to trace through step by step.', USER1_TOKEN);
    const e6 = await p6;
    console.log(`  user2 received reply-edited: replyId=${e6.replyId}`);
    await wait(300);

    // 7) User2 tries to edit user1's reply — should get 403
    console.log('\n[7] User2 tries to edit user1 reply — should get 403...');
    const r7 = await editReply(THREAD_ID, reply1.id, 'Trying to edit someone elses reply', USER2_TOKEN);
    r7.status === 403 || r7.status === 400
      ? console.log(`  ${r7.status} correctly returned — cannot edit another user reply`)
      : console.warn(`  WARNING: Expected 403 but got ${r7.status}`);
    await wait(300);

    // 8) User2 upvotes thread — user1 receives vote score broadcast
    console.log('\n[8] User2 upvotes thread — user1 should receive vote broadcast...');
    const p8 = onceWithTimeout(user1, 'threads:thread-voted');
    await voteThread(THREAD_ID, 'UPVOTE', USER2_TOKEN);
    const e8 = await p8;
    console.log(`  user1 received thread-voted: voteScore=${e8.voteScore}`);
    await wait(300);

    // 9) User1 upvotes user2's reply — user2 receives vote score broadcast
    console.log('\n[9] User1 upvotes user2 reply — user2 should receive vote broadcast...');
    const p9 = onceWithTimeout(user2, 'threads:reply-voted');
    await voteReply(THREAD_ID, reply2.id, 'UPVOTE', USER1_TOKEN);
    const e9 = await p9;
    console.log(`  user2 received reply-voted: replyId=${e9.replyId} voteScore=${e9.voteScore}`);
    await wait(300);

    // 10) User2 tries to delete user1's reply — should get 403
    console.log('\n[10] User2 tries to delete user1 reply — should get 403...');
    const r10 = await deleteReply(THREAD_ID, reply1.id, USER2_TOKEN);
    r10.status === 403 || r10.status === 400
      ? console.log(`  ${r10.status} correctly returned — cannot delete another user reply`)
      : console.warn(`  WARNING: Expected 403 but got ${r10.status}`);
    await wait(300);

    // 11) User1 deletes their own reply — user2 receives broadcast
    console.log('\n[11] User1 deletes their own reply — user2 should receive broadcast...');
    const p11 = onceWithTimeout(user2, 'threads:reply-deleted');
    await deleteReply(THREAD_ID, reply1.id, USER1_TOKEN);
    const e11 = await p11;
    console.log(`  user2 received reply-deleted: replyId=${e11.replyId}`);
    await wait(300);

    // 12) Presence — user1 leaves, user2 receives presence event
    console.log('\n[12] User1 leaves — user2 should receive presence event...');
    const p12 = onceWithTimeout(user2, 'threads:presence');
    user1.emit('threads:leave', { threadId: THREAD_ID });
    const e12 = await p12;
    console.log(`  user2 received presence: event=${e12.event} userId=${e12.userId}`);

    console.log('\nAll multi-user thread WebSocket tests passed.');

  } finally {
    user1.disconnect();
    user2.disconnect();
  }
}

main().catch((err) => {
  console.error('Multi-user thread WebSocket test failed:', err.message);
  process.exit(1);
});