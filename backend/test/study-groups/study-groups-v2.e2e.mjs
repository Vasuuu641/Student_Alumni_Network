#!/usr/bin/env node

/**
 * Study Groups V2 integration test (REST + WebSocket)
 *
 * Covers legacy + new behavior:
 * - Create/list/get/update/archive groups
 * - Public group join request flow (request -> owner approves)
 * - Invite flow (owner invites -> user accepts)
 * - Members + posts + recommendations endpoint
 * - Real-time notifications for join requests, invites, and posts
 *
 * Required env vars:
 *   OWNER_TOKEN   JWT for group owner (STUDENT/PROFESSOR)
 *   MEMBER_TOKEN  JWT for second user (STUDENT/PROFESSOR)
 * Optional env vars:
 *   BASE_URL      API origin (default http://localhost:3000)
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const localEnvPath = fileURLToPath(new URL('../../.env.study-groups.test', import.meta.url));

function loadLocalEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (key && value && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadLocalEnvFile(localEnvPath);

const OWNER_TOKEN = process.env.OWNER_TOKEN;
const MEMBER_TOKEN = process.env.MEMBER_TOKEN;

if (!OWNER_TOKEN || !MEMBER_TOKEN) {
  console.error('Missing OWNER_TOKEN or MEMBER_TOKEN.');
  console.error('Paste them into backend/.env.study-groups.test or export them in your shell.');
  console.error('Example shell command: OWNER_TOKEN=... MEMBER_TOKEN=... npm --prefix /home/vasu/Student_Alumni_Network/backend run test:study-groups:v2');
  process.exit(1);
}

function decodeJwtPayload(token) {
  const payload = token.split('.')[1];
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

const ownerPayload = decodeJwtPayload(OWNER_TOKEN);
const memberPayload = decodeJwtPayload(MEMBER_TOKEN);
const OWNER_USER_ID = ownerPayload.userId;
const MEMBER_USER_ID = memberPayload.userId;

function randomSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function http(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${method} ${path} -> ${JSON.stringify(json)}`);
  }

  return json;
}

function connectSocket(name, token) {
  const socket = io(`${BASE_URL}/study-groups`, {
    transports: ['websocket'],
    query: { token },
    extraHeaders: { authorization: `Bearer ${token}` },
    forceNew: true,
  });

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`[${name}] socket connect timeout`)), 7000);

    socket.once('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });

    socket.once('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`[${name}] socket error: ${JSON.stringify(err)}`));
    });
  });
}

function waitForEvent(socket, event, matcher, timeoutMs = 7000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timeout waiting for ${event}`));
    }, timeoutMs);

    const handler = (payload) => {
      if (!matcher || matcher(payload)) {
        clearTimeout(timer);
        socket.off(event, handler);
        resolve(payload);
      }
    };

    socket.on(event, handler);
  });
}

async function joinRoom(socket, groupId) {
  const joinedPromise = waitForEvent(socket, 'study-groups:joined', (e) => e?.groupId === groupId);
  socket.emit('study-groups:join-room', { groupId });
  return joinedPromise;
}

async function run() {
  console.log('\n=== Study Groups V2 integration test ===');

  const ownerSocket = await connectSocket('owner', OWNER_TOKEN);
  const memberSocket = await connectSocket('member', MEMBER_TOKEN);

  try {
    const suffix = randomSuffix();

    // 1) Create PUBLIC group (legacy)
    const publicGroup = await http('/study-groups', {
      method: 'POST',
      token: OWNER_TOKEN,
      body: {
        name: `V2 Public Group ${suffix}`,
        description: 'Public group for integration tests',
        visibility: 'PUBLIC',
        initialMemberIds: [],
      },
    });
    assert.ok(publicGroup?.id, 'public group should be created');

    // 2) List/get/update (legacy)
    const listed = await http('/study-groups?visibility=PUBLIC', { token: OWNER_TOKEN });
    assert.ok(Array.isArray(listed), 'list endpoint should return array');
    assert.ok(listed.some((g) => g.id === publicGroup.id), 'created public group should be listed');

    const fetched = await http(`/study-groups/${publicGroup.id}`, { token: OWNER_TOKEN });
    assert.equal(fetched.id, publicGroup.id, 'fetched group id should match');

    const updated = await http(`/study-groups/${publicGroup.id}`, {
      method: 'PATCH',
      token: OWNER_TOKEN,
      body: { name: `V2 Public Group Updated ${suffix}` },
    });
    assert.equal(updated.id, publicGroup.id, 'updated group id should match');

    // 3) Join room and verify join request realtime + approval flow (new)
    await joinRoom(ownerSocket, publicGroup.id);

    const joinRealtime = waitForEvent(
      ownerSocket,
      'study-groups:join-request-updated',
      (e) => e?.groupId === publicGroup.id && e?.requesterUserId === MEMBER_USER_ID && e?.status === 'PENDING',
    );

    const joinResult = await http(`/study-groups/${publicGroup.id}/join`, {
      method: 'POST',
      token: MEMBER_TOKEN,
      body: {},
    });

    assert.equal(joinResult.status, 'PENDING', 'public join should create pending request');
    const pendingJoinEvent = await joinRealtime;
    assert.equal(pendingJoinEvent.status, 'PENDING', 'owner should get realtime pending join-request event');

    const pendingRequests = await http(`/study-groups/${publicGroup.id}/join-requests`, { token: OWNER_TOKEN });
    const requestRow = pendingRequests.find((r) => r.userId === MEMBER_USER_ID);
    assert.ok(requestRow, 'pending join request should be visible to owner');

    const approvedRealtime = waitForEvent(
      ownerSocket,
      'study-groups:join-request-updated',
      (e) => e?.groupId === publicGroup.id && e?.requesterUserId === MEMBER_USER_ID && e?.status === 'ACCEPTED',
    );

    const review = await http(`/study-groups/${publicGroup.id}/join-requests/${requestRow.id}`, {
      method: 'PATCH',
      token: OWNER_TOKEN,
      body: { decision: 'APPROVE' },
    });
    assert.equal(review.status, 'ACCEPTED', 'owner approval should accept join request');

    const acceptedJoinEvent = await approvedRealtime;
    assert.equal(acceptedJoinEvent.status, 'ACCEPTED', 'owner should get realtime accepted join-request event');

    const membersAfterApproval = await http(`/study-groups/${publicGroup.id}/members`, { token: OWNER_TOKEN });
    assert.ok(membersAfterApproval.some((m) => m.userId === MEMBER_USER_ID), 'member should be added after approval');

    // 4) Post realtime (legacy realtime)
    await joinRoom(memberSocket, publicGroup.id);

    const postRealtime = waitForEvent(
      memberSocket,
      'study-groups:post-created',
      (e) => e?.groupId === publicGroup.id,
    );

    const createdPost = await http(`/study-groups/${publicGroup.id}/posts`, {
      method: 'POST',
      token: OWNER_TOKEN,
      body: { content: `V2 test post ${suffix}` },
    });
    assert.ok(createdPost?.id, 'post should be created');

    const postEvent = await postRealtime;
    assert.equal(postEvent.groupId, publicGroup.id, 'member should get realtime post-created event');

    // 5) Create PRIVATE group and test invite flow + realtime (new)
    const privateGroup = await http('/study-groups', {
      method: 'POST',
      token: OWNER_TOKEN,
      body: {
        name: `V2 Private Group ${suffix}`,
        description: 'Private group for invite integration test',
        visibility: 'PRIVATE',
        initialMemberIds: [],
      },
    });
    assert.ok(privateGroup?.id, 'private group should be created');

    await joinRoom(ownerSocket, privateGroup.id);

    const inviteRealtime = waitForEvent(
      ownerSocket,
      'study-groups:invite-created',
      (e) => e?.groupId === privateGroup.id && e?.invitedUserId === MEMBER_USER_ID,
    );

    const inviteResult = await http(`/study-groups/${privateGroup.id}/members`, {
      method: 'POST',
      token: OWNER_TOKEN,
      body: { userId: MEMBER_USER_ID, role: 'MEMBER' },
    });
    assert.ok(inviteResult?.inviteId, 'invite should be created when owner adds member');

    const inviteEvent = await inviteRealtime;
    assert.equal(inviteEvent.groupId, privateGroup.id, 'owner should get realtime invite-created event');

    const myInvites = await http('/study-groups/invites/me', { token: MEMBER_TOKEN });
    const invite = myInvites.find((i) => i.id === inviteResult.inviteId);
    assert.ok(invite, 'invite should appear in invited user inbox');

    const accept = await http(`/study-groups/${privateGroup.id}/invites/${invite.id}/respond`, {
      method: 'POST',
      token: MEMBER_TOKEN,
      body: { decision: 'ACCEPT' },
    });
    assert.equal(accept.status, 'ACCEPTED', 'invite acceptance should succeed');

    const privateMembers = await http(`/study-groups/${privateGroup.id}/members`, { token: OWNER_TOKEN });
    assert.ok(privateMembers.some((m) => m.userId === MEMBER_USER_ID), 'member should be in private group after invite accept');

    // 6) Recommendations endpoint (new)
    const recs = await http('/study-groups/recommendations/me?limit=5', { token: MEMBER_TOKEN });
    assert.ok(Array.isArray(recs), 'recommendations endpoint should return array');

    // 7) Archive (legacy)
    const archived = await http(`/study-groups/${publicGroup.id}/archive`, {
      method: 'PATCH',
      token: OWNER_TOKEN,
      body: {},
    });
    assert.equal(archived.id, publicGroup.id, 'archive should return target group');

    console.log('✅ All Study Groups V2 integration checks passed');
  } finally {
    ownerSocket.disconnect();
    memberSocket.disconnect();
  }
}

run().catch((error) => {
  console.error('❌ Study Groups V2 integration test failed:', error.message);
  process.exit(1);
});
