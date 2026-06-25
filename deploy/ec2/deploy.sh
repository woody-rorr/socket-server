#!/usr/bin/env bash
# EC2 단일 인스턴스 배포 — scp + ssh.
# - 로컬에서 빌드한 dist + package.json 업로드
# - 원격에서 npm install --omit=dev → systemd restart
#
# 사전 조건:
#   - EC2 인스턴스가 userdata.sh로 셋업됨 (Node 20 설치, /opt/socket-server 존재)
#   - SSM Parameter /socket-server/jwt-secret 가 EC2 인스턴스에서 fetch 가능
#   - SSH 접근: SOCKET_EC2_HOST 환경변수에 user@host 형식으로 설정
#     예: SOCKET_EC2_HOST=ec2-user@1.2.3.4
set -euo pipefail

export AWS_PROFILE="${AWS_PROFILE:-rorr-dev}"
HOST="${SOCKET_EC2_HOST:?set SOCKET_EC2_HOST=ec2-user@<ip-or-dns>}"
KEY="${SOCKET_EC2_SSH_KEY:-$HOME/.ssh/socket-server.pem}"
REMOTE_DIR="/opt/socket-server"

SSH="ssh -i $KEY -o StrictHostKeyChecking=accept-new $HOST"
SCP="scp -i $KEY -o StrictHostKeyChecking=accept-new"

echo "==> local build"
npm install --no-audit --no-fund
npm run build

echo "==> sync dist + manifest"
$SSH "sudo mkdir -p $REMOTE_DIR && sudo chown -R ec2-user:ec2-user $REMOTE_DIR"
tar -czf /tmp/socket-server-bundle.tgz dist package.json package-lock.json
$SCP /tmp/socket-server-bundle.tgz "$HOST:/tmp/socket-server-bundle.tgz"
$SSH "cd $REMOTE_DIR && tar -xzf /tmp/socket-server-bundle.tgz && rm /tmp/socket-server-bundle.tgz"

echo "==> install prod deps on host"
$SSH "cd $REMOTE_DIR && npm install --omit=dev --no-audit --no-fund"

echo "==> write /etc/socket-server.env"
$SSH "sudo bash -lc '
  cat > /etc/socket-server.env <<EOF
PORT=5020
NODE_ENV=production
RUNTIME=ec2
GRACEFUL_SHUTDOWN_MS=60000
CORS_ORIGINS=https://ai-dev-app.rorr.club
JWT_SECRET=rorr-socket-jwt-secret-2026

# Database — Aurora PostgreSQL
DB_HOST=socket-server.cwjiw4y08fiq.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=rorrService1!
DB_SSL=true
EOF
  chmod 600 /etc/socket-server.env
'"

echo "==> install systemd unit"
$SCP deploy/ec2/socket-server.service "$HOST:/tmp/socket-server.service"
$SSH "sudo mv /tmp/socket-server.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable socket-server"

echo "==> restart"
$SSH "sudo systemctl restart socket-server && sleep 2 && sudo systemctl status socket-server --no-pager | head -20"

echo "==> done."
