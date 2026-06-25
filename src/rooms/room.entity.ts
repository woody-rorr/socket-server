import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RoomMember } from './room-member.entity';
import { Channel } from '../channels/channel.entity';

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'channel_id', nullable: true })
  channel_id: string | null;

  @ManyToOne(() => Channel, (channel) => channel.rooms, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'channel_id' })
  channel: Channel | null;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 20 })
  type: 'group' | 'dm' | 'broadcast';

  @Column({ type: 'uuid', name: 'owner_id' })
  owner_id: string;

  @Column({ type: 'boolean', name: 'is_private', default: false })
  is_private: boolean;

  @Column({ type: 'jsonb', nullable: true, default: () => "'{}'" })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updated_at: Date;

  @OneToMany(() => RoomMember, (rm) => rm.room)
  members: RoomMember[];
}
