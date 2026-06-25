/**
 * 소켓 서버 부하 테스트
 * 사용법: node load-test.mjs [동시접속수] [테스트시간(초)]
 * 예시:
 *   node load-test.mjs 100 30    → 100명 동시접속 30초
 *   node load-test.mjs 500 60    → 500명 동시접속 60초
 *   node load-test.mjs 1000 60   → 1000명 동시접속 60초
 */

import { io } from 'socket.io-client';
import jwt from 'jsonwebtoken';

const SERVER     = process.env.SERVER     || 'http://52.201.212.62:5020';
const SECRET     = process.env.JWT_SECRET || 'rorr-socket-jwt-secret-2026';
const CHANNEL_ID = process.env.TEST_CHANNEL_ID || 'bad55970-84b3-4c85-9db2-5a56d579858d';
const ROOM_ID    = process.env.TEST_ROOM_ID    || '1a6035cc-9b6a-49d3-b426-ff2437e59700';

const TOTAL_USERS = parseInt(process.argv[2] ?? '100');
const DURATION_MS = parseInt(process.argv[3] ?? '30') * 1000;
const RAMP_INTERVAL = Math.max(10, Math.floor(2000 / TOTAL_USERS)); // 2초에 걸쳐 ramp-up

const CLIENT_TYPES = ['web', 'overlay', 'side'];

// ── 지표 ────────────────────────────────────────────────────
const stats = {
  connected: 0,
  connectFailed: 0,
  joinOk: 0,
  joinFail: 0,
  msgSent: 0,
  msgReceived: 0,
  errors: 0,
  latencies: [],
};

let activeClients = 0;

const makeToken = (idx) => {
  const userId = `aaaaaaaa-bbbb-cccc-dddd-${String(idx).padStart(12, '0')}`;
  return { token: jwt.sign({ sub: userId }, SECRET, { expiresIn: '2h' }), userId };
};

// ── 클라이언트 1개 시뮬레이션 ────────────────────────────────
function spawnClient(idx) {
  return new Promise((resolve) => {
    const clientType = CLIENT_TYPES[idx % 3];
    const { token } = makeToken(idx);

    const s = io(SERVER, {
      auth: { token, clientType, channelId: CHANNEL_ID },
      timeout: 5000,
      reconnection: false,
    });

    let joined = false;

    s.on('connect_error', () => {
      stats.connectFailed++;
      resolve();
    });

    s.on('error', () => {
      stats.errors++;
    });

    s.on('room:message', () => {
      stats.msgReceived++;
    });

    s.on('connected', () => {
      stats.connected++;
      activeClients++;

      // room join
      const t0 = Date.now();
      s.emit('room:join', { roomId: ROOM_ID }, (res) => {
        const latency = Date.now() - t0;
        stats.latencies.push(latency);
        if (res?.ok) {
          stats.joinOk++;
          joined = true;

          // 주기적으로 메시지 전송 (10명 중 1명만)
          if (idx % 10 === 0) {
            const interval = setInterval(() => {
              s.emit('room:message', { roomId: ROOM_ID, text: `load-test msg from ${idx}` }, () => {
                stats.msgSent++;
              });
            }, 2000);

            setTimeout(() => {
              clearInterval(interval);
              s.disconnect();
              activeClients--;
              resolve();
            }, DURATION_MS);
          } else {
            setTimeout(() => {
              s.disconnect();
              activeClients--;
              resolve();
            }, DURATION_MS);
          }
        } else {
          stats.joinFail++;
          s.disconnect();
          activeClients--;
          resolve();
        }
      });
    });

    // 연결 후 join 없이 끊길 경우 대비
    setTimeout(() => {
      if (!joined) {
        s.disconnect();
        activeClients--;
        resolve();
      }
    }, DURATION_MS + 6000);
  });
}

// ── 실행 ─────────────────────────────────────────────────────
console.log(`\n🚀 부하 테스트 시작`);
console.log(`   서버: ${SERVER}`);
console.log(`   동시접속: ${TOTAL_USERS}명`);
console.log(`   테스트 시간: ${DURATION_MS / 1000}초`);
console.log(`   Ramp-up: ${RAMP_INTERVAL}ms 간격으로 클라이언트 추가\n`);

const startTime = Date.now();

// 진행상황 출력 (5초마다)
const progressTimer = setInterval(() => {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  process.stdout.write(
    `\r⏱  ${elapsed}s | 연결: ${stats.connected} | 실패: ${stats.connectFailed} | 활성: ${activeClients} | 메시지수신: ${stats.msgReceived}   `
  );
}, 1000);

// ramp-up: 순차적으로 클라이언트 생성
const promises = [];
for (let i = 0; i < TOTAL_USERS; i++) {
  promises.push(
    new Promise((resolve) => setTimeout(() => spawnClient(i).then(resolve), i * RAMP_INTERVAL))
  );
}

await Promise.all(promises);
clearInterval(progressTimer);

// ── 결과 출력 ─────────────────────────────────────────────────
const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
const latencies = stats.latencies.sort((a, b) => a - b);
const p50 = latencies[Math.floor(latencies.length * 0.5)] ?? 0;
const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
const p99 = latencies[Math.floor(latencies.length * 0.99)] ?? 0;
const avg = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;

console.log(`\n\n${'─'.repeat(50)}`);
console.log(`📊 결과 (총 ${totalTime}초)`);
console.log(`${'─'.repeat(50)}`);
console.log(`연결 성공:     ${stats.connected} / ${TOTAL_USERS}`);
console.log(`연결 실패:     ${stats.connectFailed}`);
console.log(`room:join 성공: ${stats.joinOk}`);
console.log(`room:join 실패: ${stats.joinFail}`);
console.log(`메시지 전송:   ${stats.msgSent}`);
console.log(`메시지 수신:   ${stats.msgReceived}`);
console.log(`에러:          ${stats.errors}`);
console.log(`\nroom:join 레이턴시`);
console.log(`  avg: ${avg}ms  p50: ${p50}ms  p95: ${p95}ms  p99: ${p99}ms`);
console.log(`${'─'.repeat(50)}\n`);
