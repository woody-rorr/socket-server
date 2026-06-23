import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Room } from './room.entity';

@Entity('room_members')
export class RoomMember {
  @PrimaryColumn({ type: 'uuid', name: 'room_id' })
  room_id: string;

  @PrimaryColumn({ type: 'uuid', name: 'user_id' })
  user_id: string;

  @Column({ type: 'varchar', length: 20, default: 'member' })
  role: 'owner' | 'admin' | 'member';

  @CreateDateColumn({ type: 'timestamptz', name: 'joined_at' })
  joined_at: Date;

  @ManyToOne(() => Room, (room) => room.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  room: Room;
}
