-- Migration 001: channels 테이블 생성 + rooms에 channel_id FK 추가
-- PostgreSQL (Aurora)
-- 실행: psql $DATABASE_URL -f deploy/migrations/001_channels_and_rooms.sql

BEGIN;

-- channels
CREATE TABLE IF NOT EXISTS channels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id    VARCHAR(100) NOT NULL UNIQUE,
  status      VARCHAR(20)  NOT NULL DEFAULT 'scheduled'
                CHECK (status IN ('scheduled', 'live', 'ended')),
  metadata    JSONB        NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- rooms (기존 테이블이 없으면 생성, 있으면 channel_id 컬럼만 추가)
CREATE TABLE IF NOT EXISTS rooms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id  UUID REFERENCES channels(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  type        VARCHAR(20)  NOT NULL CHECK (type IN ('group', 'dm', 'broadcast')),
  owner_id    UUID         NOT NULL,
  is_private  BOOLEAN      NOT NULL DEFAULT FALSE,
  metadata    JSONB        NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- rooms 테이블이 이미 존재할 경우 channel_id 컬럼 추가
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES channels(id) ON DELETE CASCADE;

-- room_members
CREATE TABLE IF NOT EXISTS room_members (
  room_id     UUID        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL,
  role        VARCHAR(20) NOT NULL DEFAULT 'member'
                CHECK (role IN ('owner', 'admin', 'member')),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'channels_updated_at') THEN
    CREATE TRIGGER channels_updated_at
      BEFORE UPDATE ON channels
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'rooms_updated_at') THEN
    CREATE TRIGGER rooms_updated_at
      BEFORE UPDATE ON rooms
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_rooms_channel_id ON rooms(channel_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user_id ON room_members(user_id);

COMMIT;
