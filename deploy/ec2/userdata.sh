#!/usr/bin/env bash
# EC2 launch 시 1회 실행. Amazon Linux 2023 기준.
# - Node 20 설치
# - /opt/socket-server 디렉토리 준비
# - systemd unit 설치 (배포 스크립트가 placeholder 채움)
set -euo pipefail

dnf update -y
dnf install -y nodejs git tar gzip jq

mkdir -p /opt/socket-server
chown -R ec2-user:ec2-user /opt/socket-server

# 빈 env 파일 — 배포 스크립트가 채움. (또는 SSM에서 fetch)
touch /etc/socket-server.env
chmod 600 /etc/socket-server.env

# systemd unit은 배포 스크립트가 scp로 올리고 enable.
echo "[userdata] base setup done"
