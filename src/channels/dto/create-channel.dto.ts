export class CreateChannelDto {
  match_id: string;
  status?: 'scheduled' | 'live' | 'ended';
  metadata?: Record<string, unknown>;
}
