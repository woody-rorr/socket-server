export class CreateRoomDto {
  channel_id?: string;
  name: string;
  type: 'group' | 'dm' | 'broadcast';
  owner_id: string;
  is_private?: boolean;
  metadata?: Record<string, unknown>;
}
