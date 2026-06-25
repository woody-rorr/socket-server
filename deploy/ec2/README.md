# EC2 단일 인스턴스 배포

## CI/CD (GitHub Actions)

워크플로우: `.github/workflows/deploy-socket-server.yml`  
트리거: `main` 브랜치 push + `socket-server/**` 경로 변경 시 자동 배포

### GitHub Environment Secrets 등록 (`dev`)

GitHub repo → Settings → Environments → `dev` 생성 후 아래 3개 등록:

| Secret 이름 | 값 형식 | 설명 |
|---|---|---|
| `EC2_SSH_KEY` | PEM 파일 전체 내용 (`-----BEGIN RSA PRIVATE KEY-----` 포함) | SSH 접속 키 |
| `EC2_HOST` | `ec2-user@1.2.3.4` | SSH 접속 주소 |
| `EC2_HOST_IP` | `1.2.3.4` | health check용 IP (EC2_HOST에서 user@ 제거한 것) |

> 나중에 `rorr-backend-api-v2` prod 환경 추가 시: Environment `prod` 생성 + 동일 키 이름으로 secret 등록만 하면 됨

---

## 사전 인프라 (1회 셋업)

| 리소스 | 값 |
|---|---|
| AWS Profile | `rorr-dev` |
| Region | `us-east-1` |
| EC2 Instance Type | `t3.small` (시작 권장) |
| AMI | Amazon Linux 2023 |
| Userdata | `deploy/ec2/userdata.sh` |
| Security Group | 인바운드 5020 (ALB SG에서만) + 22 (sshd 자기 IP만) |
| Instance Profile (IAM) | SSM Parameter read 권한 (`/socket-server/*`) |
| Target Group | `socket-server-ec2-tg` (instance type, port 5020) |
| ALB | 기존 `mcp-agents-staging-alb` 재사용 |
| ALB Listener | `socket-ec2.rorr.club` host header rule |

### EC2 인스턴스 1회 준비

1. Amazon Linux 2023로 launch, userdata에 `userdata.sh` 내용 붙여넣기
2. IAM Instance Profile에 SSM read 권한 첨부
3. SG 5020 포트 ALB SG에서만 열기
4. 인스턴스 IP/DNS 확인 → `SOCKET_EC2_HOST` 환경변수에 설정

### ALB Target Group 핵심
- Idle timeout 3600초 (WebSocket)
- Deregistration delay 300초
- Health check: `GET /health`

## 배포

```bash
export AWS_PROFILE=rorr-dev
export SOCKET_EC2_HOST=ec2-user@<인스턴스-IP-or-DNS>
export SOCKET_EC2_SSH_KEY=$HOME/.ssh/socket-server.pem
bash deploy/ec2/deploy.sh
```

## 운영 메모

- 로그 확인: `journalctl -u socket-server -f` (인스턴스 ssh 후)
- 재시작: `sudo systemctl restart socket-server`
- 상태: `sudo systemctl status socket-server`
- env 변경: `/etc/socket-server.env` 수정 + restart

## ECS 대비 장단점

**장점**:
- 인스턴스 1대 고정 → 연결 끊김 거의 없음 (오토스케일 X)
- 메모리 안에 모든 클라이언트 → Redis 불필요
- 로그·디버깅 직관적 (직접 ssh)

**단점**:
- 인스턴스 1대 죽으면 전체 다운 (HA 0)
- 트래픽 폭증 시 수동 스케일 또는 ASG 추가 필요
- 패치/업데이트 수동
