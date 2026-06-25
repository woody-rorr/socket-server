/**
 * 실시간 소켓 REPL 클라이언트
 * 사용법:
 *   터미널 1: node repl-client.mjs web    user-1  bad55970-84b3-4c85-9db2-5a56d579858d
 *   터미널 2: node repl-client.mjs overlay user-2  bad55970-84b3-4c85-9db2-5a56d579858d
 *   터미널 3: node repl-client.mjs side    user-3  bad55970-84b3-4c85-9db2-5a56d579858d
 *
 * 접속 후 명령어:
 *   /join <roomId>         — room 입장
 *   /leave <roomId>        — room 퇴장
 *   /msg <roomId> <text>   — room 메시지 전송
 *   /ping                  — ping 테스트
 *   /quit                  — 종료
 *   그 외 입력              — 현재 joined room 전체에 브로드캐스트
 */

import { createInterface } from 'readline';
import { io } from 'socket.io-client';
import jwt from 'jsonwebtoken';

const SERVER   = process.env.SERVER   || 'http://52.201.212.62:5020';
const SECRET   = process.env.JWT_SECRET || 'rorr-socket-jwt-secret-2026';

const [clientType = 'web', userAlias = 'user-1', channelId = ''] = process.argv.slice(2);

const USER_IDS = {
  'user-1': '00000000-0000-0000-0000-000000000001',
  'user-2': '00000000-0000-0000-0000-000000000002',
  'user-3': '00000000-0000-0000-0000-000000000003',
  'user-4': '00000000-0000-0000-0000-000000000004',
  'user-5': '00000000-0000-0000-0000-000000000005',
};
const userId = USER_IDS[userAlias] ?? userAlias;
const token  = jwt.sign({ sub: userId, email: `${userAlias}@rorr.club` }, SECRET, { expiresIn: '8h' });

const PREFIX = `[${clientType.toUpperCase()}:${userAlias}]`;

console.log(`\n${PREFIX} 서버 접속 중... ${SERVER}`);
console.log(`${PREFIX} channelId: ${channelId || '(없음)'}\n`);

const socket = io(SERVER, {
  auth: { token, clientType, channelId },
  reconnection: true,
  timeout: 5000,
});

// ── 이벤트 수신 ────────────────────────────────────────────
socket.on('connected', (data) => {
  console.log(`\n✅ ${PREFIX} 연결됨 — userId=${data.userId} channelId=${data.channelId || '-'}`);
  console.log(`명령어: /join <roomId>  /leave <roomId>  /msg <roomId> <text>  /ping  /quit\n`);
  rl.prompt();
});

socket.on('room:message', (data) => {
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  console.log(`\n📨 [room:${data.roomId}] ${data.from} (${data.clientType ?? '?'}): ${data.text}`);
  rl.prompt(true);
});

socket.on('server:reconnect', (data) => {
  console.log(`\n⚠️  서버 재시작 신호 수신 (${data.reason}) — 재연결 중...`);
});

socket.on('error', (err) => {
  console.log(`\n❌ 에러: ${JSON.stringify(err)}`);
  rl.prompt(true);
});

socket.on('disconnect', (reason) => {
  console.log(`\n🔌 연결 끊김: ${reason}`);
});

socket.on('reconnect', () => {
  console.log(`\n🔄 재연결 성공`);
  rl.prompt(true);
});

// ── REPL ───────────────────────────────────────────────────
const rl = createInterface({ input: process.stdin, output: process.stdout });
rl.setPrompt(`${PREFIX} > `);

rl.on('line', (line) => {
  const input = line.trim();
  if (!input) { rl.prompt(); return; }

  const [cmd, ...args] = input.split(' ');

  if (cmd === '/quit') {
    socket.disconnect();
    process.exit(0);

  } else if (cmd === '/join') {
    const roomId = args[0];
    if (!roomId) { console.log('사용법: /join <roomId>'); rl.prompt(); return; }
    socket.emit('room:join', { roomId }, (res) => {
      if (res?.ok) console.log(`✅ room 입장: ${roomId}`);
      else console.log(`❌ room:join 실패: ${JSON.stringify(res)}`);
      rl.prompt();
    });

  } else if (cmd === '/leave') {
    const roomId = args[0];
    if (!roomId) { console.log('사용법: /leave <roomId>'); rl.prompt(); return; }
    socket.emit('room:leave', { roomId }, (res) => {
      if (res?.ok) console.log(`✅ room 퇴장: ${roomId}`);
      else console.log(`❌ room:leave 실패: ${JSON.stringify(res)}`);
      rl.prompt();
    });

  } else if (cmd === '/msg') {
    const roomId = args[0];
    const text   = args.slice(1).join(' ');
    if (!roomId || !text) { console.log('사용법: /msg <roomId> <text>'); rl.prompt(); return; }
    socket.emit('room:message', { roomId, text }, (res) => {
      if (!res?.ok) console.log(`❌ 전송 실패: ${JSON.stringify(res)}`);
      rl.prompt();
    });

  } else if (cmd === '/ping') {
    const t = Date.now();
    socket.emit('ping', {}, (res) => {
      console.log(`🏓 pong — RTT ${Date.now() - t}ms`);
      rl.prompt();
    });

  } else {
    console.log('알 수 없는 명령어. /join /leave /msg /ping /quit');
    rl.prompt();
  }
});

rl.on('close', () => { socket.disconnect(); process.exit(0); });
