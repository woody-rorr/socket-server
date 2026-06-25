/**
 * 소켓 서버 기본 테스트 스크립트
 * 실행: node test-socket.mjs
 *
 * 사전 조건:
 *   1. 서버 실행 중: JWT_SECRET=test-secret npm run start:dev
 *   2. socket.io-client 설치: npm install --no-save socket.io-client
 */

import { io } from 'socket.io-client';
import jwt from 'jsonwebtoken';

const SERVER = process.env.SERVER || 'http://localhost:5020';
const SECRET = process.env.JWT_SECRET || 'test-secret';
// EC2 테스트 시 실제 채널/룸 ID 지정 (없으면 DB 없는 로컬 모드로 동작)
const TEST_CHANNEL_ID = process.env.TEST_CHANNEL_ID || '';
const TEST_ROOM_ID = process.env.TEST_ROOM_ID || '';

// userId는 UUID 형식이어야 함 — room_members.user_id 컬럼이 UUID 타입
const USER_IDS = {
  'user-a':         '00000000-0000-0000-0000-000000000001',
  'user-b':         '00000000-0000-0000-0000-000000000002',
  'user-ping':      '00000000-0000-0000-0000-000000000003',
  'user-sender':    '00000000-0000-0000-0000-000000000004',
  'user-receiver':  '00000000-0000-0000-0000-000000000005',
  'user-outsider':  '00000000-0000-0000-0000-000000000006',
  'user-web-1':     '00000000-0000-0000-0000-000000000007',
  'user-web-2':     '00000000-0000-0000-0000-000000000008',
  'user-overlay-1': '00000000-0000-0000-0000-000000000009',
};

const makeToken = (userId, options = {}) => {
  const uuid = USER_IDS[userId] ?? userId;
  return jwt.sign({ sub: uuid, email: `${userId}@test.com` }, SECRET, { expiresIn: '1h', ...options });
};

let passed = 0;
let failed = 0;

const ok  = (label) => { console.log(`  ✅ ${label}`); passed++; };
const fail = (label) => { console.log(`  ❌ ${label}`); failed++; };

const connect = (token, opts = {}) =>
  new Promise((resolve) => {
    const auth = token ? { auth: { token, ...opts.auth } } : {};
    const client = io(SERVER, { ...auth, timeout: 4000 });
    resolve(client);
  });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────────
// 테스트 1: 연결 — 유효한 토큰 + clientType/channelId
// ─────────────────────────────────────────────
async function test1() {
  const channelId = TEST_CHANNEL_ID || 'ch-001';
  console.log(`\n[1] 연결 — 유효한 JWT 토큰 (clientType=web, channelId=${channelId})`);
  const client = io(SERVER, {
    auth: { token: makeToken('user-a'), clientType: 'web', channelId },
    timeout: 4000,
  });

  await new Promise((resolve) => {
    let done = false;
    const expectedUserId = USER_IDS['user-a'];

    client.on('connected', (data) => {
      if (!done && data.userId === expectedUserId && data.clientType === 'web' && data.channelId === channelId) {
        ok('connected 이벤트 수신, userId/clientType/channelId 일치');
        done = true;
      } else if (!done) {
        fail(`connected 데이터 불일치: ${JSON.stringify(data)}`);
        done = true;
      }
      client.disconnect();
      resolve();
    });

    setTimeout(() => {
      if (!done) { fail('connected 이벤트 미수신'); client.disconnect(); resolve(); }
    }, 3000);
  });
}

// ─────────────────────────────────────────────
// 테스트 2: 연결 거부 — 토큰 없음
// ─────────────────────────────────────────────
async function test2() {
  console.log('\n[2] 연결 거부 — 토큰 없음');
  const client = await connect(null);

  await new Promise((resolve) => {
    let done = false;

    client.on('error', (data) => {
      if (!done && data.code === 'UNAUTHENTICATED') {
        ok('UNAUTHENTICATED 에러 수신');
        done = true;
      }
    });

    client.on('disconnect', () => {
      if (!done) { fail('error 이벤트 없이 disconnect'); }
      resolve();
    });

    setTimeout(() => {
      if (!done) { fail('에러/disconnect 미수신'); client.disconnect(); resolve(); }
    }, 3000);
  });
}

// ─────────────────────────────────────────────
// 테스트 3: Room join / leave
// DB 없는 환경: 소켓 join 성공
// DB 있는 환경: ROOM_NOT_FOUND → 에러 정상 수신 확인
// ─────────────────────────────────────────────
async function test3() {
  const roomId = TEST_ROOM_ID || 'room-abc';
  const channelId = TEST_CHANNEL_ID || '';
  console.log(`\n[3] Room join / leave (roomId=${roomId})`);

  const client = io(SERVER, {
    auth: { token: makeToken('user-b'), clientType: 'web', channelId },
    timeout: 4000,
  });

  await new Promise((resolve) => {
    client.on('connected', async () => {
      let joinDone = false;

      client.emit('room:join', { roomId }, (res) => {
        joinDone = true;
        if (res?.ok && res.roomId === roomId) {
          ok('room:join 성공');
          client.emit('room:leave', { roomId }, (r) => {
            if (r?.ok) ok('room:leave 성공');
            else fail(`room:leave 실패: ${JSON.stringify(r)}`);
            client.disconnect();
            resolve();
          });
        } else {
          fail(`room:join 실패: ${JSON.stringify(res)}`);
          client.disconnect();
          resolve();
        }
      });

      setTimeout(() => {
        if (!joinDone) { fail('room:join/leave 타임아웃'); client.disconnect(); resolve(); }
      }, 6000);
    });
  });
}

// ─────────────────────────────────────────────
// 테스트 4: 메시지 브로드캐스트
// ─────────────────────────────────────────────
async function test4() {
  const ROOM = TEST_ROOM_ID || 'broadcast-test-room';
  const channelId = TEST_CHANNEL_ID || '';
  console.log(`\n[4] 메시지 브로드캐스트 (roomId=${ROOM})`);

  const mkClient = (userId) => io(SERVER, {
    auth: { token: makeToken(userId), clientType: 'web', channelId }, timeout: 4000,
  });
  const clientA = mkClient('user-sender');
  const clientB = mkClient('user-receiver');
  const clientC = mkClient('user-outsider');

  await new Promise((resolve) => {
    let aReady = false, bReady = false;

    const tryBroadcast = async () => {
      if (!aReady || !bReady) return;

      // C는 room join 안 함
      let cReceived = false;
      clientC.on('room:message', () => { cReceived = true; });

      clientA.emit('room:message', { roomId: ROOM, text: 'hello' }, (res) => {
        if (res?.ok) ok('room:message 전송 성공');
        else fail('room:message 전송 실패');
      });

      await wait(500);

      if (cReceived) fail('room 미참여 C가 메시지 수신 (격리 실패)');
      else ok('room 미참여 C는 메시지 미수신 (정상)');

      clientA.disconnect(); clientB.disconnect(); clientC.disconnect();
      resolve();
    };

    clientA.on('connected', () => {
      clientA.emit('room:join', { roomId: ROOM }, () => { aReady = true; tryBroadcast(); });
    });

    clientB.on('connected', () => {
      clientB.emit('room:join', { roomId: ROOM }, () => {
        bReady = true;

        clientB.on('room:message', (data) => {
          if (data.text === 'hello' && data.from === USER_IDS['user-sender']) ok('B가 메시지 정상 수신');
          else fail(`B가 수신한 메시지 내용 불일치: ${JSON.stringify(data)}`);
        });

        tryBroadcast();
      });
    });

    setTimeout(() => { fail('브로드캐스트 타임아웃'); clientA.disconnect(); clientB.disconnect(); clientC.disconnect(); resolve(); }, 5000);
  });
}

// ─────────────────────────────────────────────
// 테스트 5: Ping / Latency
// ─────────────────────────────────────────────
async function test5() {
  console.log('\n[5] Ping / Latency');
  const client = await connect(makeToken('user-ping'));

  await new Promise((resolve) => {
    client.on('connected', () => {
      const sent = Date.now();
      client.emit('ping', {}, (res) => {
        const latency = Date.now() - sent;
        if (res?.pong) ok(`pong 수신, RTT ${latency}ms`);
        else fail('pong 미수신');
        client.disconnect();
        resolve();
      });
    });

    setTimeout(() => { fail('ping 타임아웃'); client.disconnect(); resolve(); }, 3000);
  });
}

// ─────────────────────────────────────────────
// 테스트 6: Health Check (HTTP)
// ─────────────────────────────────────────────
async function test6() {
  console.log('\n[6] Health Check (GET /health)');
  try {
    const res = await fetch(`${SERVER}/health`);
    if (res.ok) ok(`HTTP ${res.status} 응답`);
    else fail(`HTTP ${res.status}`);
  } catch (e) {
    fail(`fetch 실패: ${e.message}`);
  }
}

// ─────────────────────────────────────────────
// 실행
// ─────────────────────────────────────────────
(async () => {
  console.log(`\n🔌 Socket 서버 테스트 → ${SERVER}`);
  console.log('────────────────────────────────────');

  await test1();
  await test2();
  await test3();
  await test4();
  await test5();
  await test6();

  console.log('\n────────────────────────────────────');
  console.log(`결과: ✅ ${passed}  ❌ ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
})();
