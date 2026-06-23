# rorr-socket-server

NestJS + socket.io 기반 WebSocket 서버. **하나의 코드 베이스**로 ECS Fargate와 EC2 둘 다 운영 가능.

```
src/                       ← 앱 코드 (양쪽 공통)
deploy/ecs/                ← ECS Fargate 배포 셋
deploy/ec2/                ← EC2 단일 인스턴스 배포 셋
.github/workflows/         ← 각 환경별 자동 배포 워크플로
```

> 코드 1번, 배포 2번. 같은 코드를 두 환경에서 띄우고 운영하며 어느 쪽이 실무에 맞는지 데이터로 판단.

## 핵심 기능

- JWT 인증 (rorr-backend-api-v2와 동일 secret 공유)
- 채팅방 join/leave, broadcast (`room:join`, `room:message`)
- 사용자별 채널 (`user:<id>`) — 서버 push 가능
- `ping/pong` 헬스 + `/health` HTTP 엔드포인트
- SIGTERM graceful shutdown (60초 동안 클라에 `server:reconnect` 신호 + 종료)

## 로컬 실행

```bash
cp .env.example .env
# .env의 JWT_SECRET을 rorr-backend-api-v2와 동일하게 설정
npm install
npm run start:dev
```

테스트 (socket.io 클라이언트):
```js
const socket = io('http://localhost:5020', { auth: { token: '<accessToken>' } });
socket.on('connected', console.log);
socket.emit('room:join', { roomId: '123' });
socket.emit('room:message', { roomId: '123', text: 'hi' });
socket.on('room:message', console.log);
```

## 환경변수

| 이름 | 기본 | 설명 |
|---|---|---|
| `PORT` | 5020 | listen port |
| `RUNTIME` | local | `ecs` \| `ec2` \| `local` |
| `JWT_SECRET` | (필수) | rorr-backend-api-v2와 동일 secret |
| `GRACEFUL_SHUTDOWN_MS` | 30000 | SIGTERM 후 종료까지 대기 |
| `CORS_ORIGINS` | `*` | 콤마 구분 |

## 배포

### ECS Fargate
```bash
export AWS_PROFILE=rorr-dev
bash deploy/ecs/deploy.sh
```
→ 상세: [`deploy/ecs/README.md`](deploy/ecs/README.md)

### EC2 단일 인스턴스
```bash
export AWS_PROFILE=rorr-dev
export SOCKET_EC2_HOST=ec2-user@<host>
bash deploy/ec2/deploy.sh
```
→ 상세: [`deploy/ec2/README.md`](deploy/ec2/README.md)

### CI 자동 배포
- `src/**` 또는 `Dockerfile` 변경 → `deploy-ecs.yml` 트리거
- `src/**` 또는 `deploy/ec2/**` 변경 → `deploy-ec2.yml` 트리거
  (둘 다 동시에 돌아도 무관 — 같은 코드를 양쪽에 배포)

## 운영 시 알아야 할 차이

| 상황 | ECS | EC2 |
|---|---|---|
| 배포 시 연결 | 새 task 뜨면서 기존 task 종료 → 끊김 발생, 클라이언트 재연결 필요 | 같은 인스턴스 systemd restart → 잠깐 끊김 후 재연결 |
| 인스턴스 수 | 오토스케일 가능 (sticky session 필수) | 기본 1대 (ASG 추가 시 가능) |
| 연결 한계 | task당 메모리/CPU 비례, 여러 task로 분산 | 1대 분량으로 제한 (t3.small: 약 1~3만) |
| 다중 인스턴스 broadcast | Redis adapter 필요 (>=2 task) | 1대면 불필요. ASG 시 필요 |
| 비용 (idle) | task 수 × Fargate 단가 | 인스턴스 1대 고정 |
| 로그 | CloudWatch Logs | journalctl (또는 CloudWatch agent) |

## 다중 task/instance 확장 (선택)

socket.io는 task가 2개 이상이면 **Redis adapter**가 필요합니다 (메시지 cross-task 전파).
```bash
npm install @socket.io/redis-adapter ioredis
```
`main.ts`에 adapter 부착 + `REDIS_URL` env 추가. ElastiCache 비용 필요.

## 한계 & 주의

- **이메일 같은 이메일 = 같은 user_id** 정책은 rorr-backend-api-v2가 발급하는 JWT가 책임짐 (이 서버는 sub만 신뢰)
- **재연결은 클라이언트 책임** — 지수 백오프 + 토큰 갱신 권장
- **ALB idle timeout 60초 기본은 너무 짧음** — 3600초 이상으로 조정 필수
