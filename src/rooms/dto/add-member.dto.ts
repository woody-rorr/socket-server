export class AddMemberDto {
  user_id: string;
  role?: 'owner' | 'admin' | 'member';
}
