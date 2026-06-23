#!/usr/bin/env bash
# ECS Fargate 배포 — 로컬에서 수동 배포 시 사용.
# CI에서는 .github/workflows/deploy-ecs.yml가 동일 흐름 실행.
#
# 사전 조건:
#   - AWS profile rorr-dev (Account 239460481239, region us-east-1)
#   - ECR repo: socket-server
#   - ECS Cluster: mcp-agents-staging-cluster
#   - ECS Service: socket-server-service (Target Group socket-server-tg 연결)
#   - SSM Parameter: /socket-server/jwt-secret (SecureString)
#   - IAM Roles: socket-server-execution, socket-server-task
set -euo pipefail

export AWS_PROFILE="${AWS_PROFILE:-rorr-dev}"
AWS_REGION="us-east-1"
ACCOUNT_ID="239460481239"
ECR_REPO="socket-server"
CLUSTER="mcp-agents-staging-cluster"
SERVICE="socket-server-service"
TASK_FAMILY="socket-server-task"

IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"
IMAGE_URI="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}:${IMAGE_TAG}"

echo "==> ECR login"
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

echo "==> docker build (linux/amd64)"
docker buildx build --platform linux/amd64 -t "$IMAGE_URI" --push .

echo "==> register task definition revision"
TD=$(jq --arg img "$IMAGE_URI" '.containerDefinitions[0].image = $img' deploy/ecs/task-definition.json)
NEW_TD_ARN=$(aws ecs register-task-definition \
  --region "$AWS_REGION" \
  --cli-input-json "$TD" \
  --query 'taskDefinition.taskDefinitionArn' --output text)
echo "    -> $NEW_TD_ARN"

echo "==> update service"
aws ecs update-service \
  --region "$AWS_REGION" \
  --cluster "$CLUSTER" \
  --service "$SERVICE" \
  --task-definition "$NEW_TD_ARN" \
  --force-new-deployment >/dev/null

echo "==> wait for service stable"
aws ecs wait services-stable \
  --region "$AWS_REGION" \
  --cluster "$CLUSTER" \
  --services "$SERVICE"

echo "==> done. image=$IMAGE_URI"
