# ECS Fargate 배포

## 사전 인프라 (1회 셋업)

| 리소스 | 값 |
|---|---|
| AWS Profile | `rorr-dev` |
| Account | `239460481239` |
| Region | `us-east-1` |
| ECR Repo | `socket-server` |
| ECS Cluster | `mcp-agents-staging-cluster` (기존 재사용) |
| ECS Service | `socket-server-service` |
| ECS Task Definition | `socket-server-task` |
| Target Group | `socket-server-tg` (HTTP :5020, deregistration delay **300s**) |
| ALB | 기존 `mcp-agents-staging-alb` 재사용 |
| ALB Listener | 별도 host 또는 `/socket.io/*` path rule |
| SSM Param | `/socket-server/jwt-secret` (SecureString) |
| Execution Role | `socket-server-execution` (ECR read + SSM read + logs) |
| Task Role | `socket-server-task` (앱 권한, 현재는 비어 있어도 OK) |
| Log Group | `/ecs/socket-server` |

### ALB 핵심 설정
- **Idle timeout 3600초** 이상 (WebSocket 끊김 방지)
- Target group **Sticky session ON** (lb_cookie, 1일)
- Health check path: `/health`

### Sticky session이 필요한 이유
socket.io는 polling → upgrade 단계가 있어 같은 task에 붙어야 함.
ALB의 sticky session(lb_cookie)을 켜야 polling 단계가 안 깨짐.

## 배포

### 수동
```bash
export AWS_PROFILE=rorr-dev
bash deploy/ecs/deploy.sh
```

### CI
`dev` 브랜치에 머지되면 `.github/workflows/deploy-ecs.yml`가 자동 실행.

## 운영 메모

- **stopTimeout: 90초** — graceful shutdown이 충분히 끝날 시간 확보
- `GRACEFUL_SHUTDOWN_MS=60000` — 60초간 클라에 재연결 신호 보낸 후 종료
- 스케일 아웃 시 새 task가 ALB 등록 → 다음 신규 연결은 그쪽으로 분산
- 스케일 인 시 ALB가 deregistration(300s) 동안 새 연결 안 보냄 → 기존 연결은 끊김 (클라 재연결 필요)

## 다중 task로 확장 시

현재는 task 1대 기준. 2대 이상으로 확장하면 **방 단위 broadcast가 task 간 전파 안 됨** → 두 가지 선택:
1. `@socket.io/redis-adapter` + ElastiCache 추가 (`REDIS_URL` env 추가)
2. 그대로 두고 sticky session으로 같은 방 클라이언트가 같은 task에 몰리도록 (불완전)
