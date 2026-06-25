# Socket Server 개발 메모

## sync on connect (미구현 — 추후 개발)

### 개념
유저가 채널에 접속했을 때, 현재 진행 중인 상태가 있으면 해당 유저에게만 현재 상태를 전송.

### 구현 방향
- 서버 메모리에 채널별 마지막 상태 보관 (`channelState` Map)
- connect 시 해당 channelId의 상태가 있으면 접속자에게만 `sync` 이벤트 emit
- 상태 없으면 sync 없음

```ts
// 구조 예시
channelState: Map<channelId, {
  event: string,    // 마지막 broadcast 이벤트명 (예: 'quiz:open', 'score:update')
  payload: unknown, // 해당 데이터
  ts: number        // 마지막 업데이트 시각
}>

// connect 시
const state = channelState.get(identity.channelId);
if (state) {
  client.emit('sync', state);
}

// broadcast 시 상태 업데이트
channelState.set(channelId, { event, payload, ts: Date.now() });
```

### 나중에 MSK(Kafka) 붙일 때
- Kafka에서 게임 이벤트 수신 → `channelState` 업데이트
- 이후 접속자는 자동으로 최신 상태 sync

### 비고
- 퀴즈, 라이브 스코어, 기타 이벤트 모두 동일한 구조로 처리 가능
- 기존 Lambda `liveQuizSyncOnConnect` 와 동일한 역할
