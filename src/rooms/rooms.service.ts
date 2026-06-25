import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from './room.entity';
import { RoomMember } from './room-member.entity';
import { CreateRoomDto } from './dto/create-room.dto';
import { AddMemberDto } from './dto/add-member.dto';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepo: Repository<Room>,

    @InjectRepository(RoomMember)
    private readonly memberRepo: Repository<RoomMember>,
  ) {}

  findAll(): Promise<Room[]> {
    return this.roomRepo.find({ order: { created_at: 'DESC' } });
  }

  async findOne(id: string): Promise<Room> {
    const room = await this.roomRepo.findOne({ where: { id } });
    if (!room) throw new NotFoundException(`Room ${id} not found`);
    return room;
  }

  create(dto: CreateRoomDto): Promise<Room> {
    const room = this.roomRepo.create({
      channel_id: dto.channel_id ?? null,
      name: dto.name,
      type: dto.type,
      owner_id: dto.owner_id,
      is_private: dto.is_private ?? false,
      metadata: dto.metadata ?? {},
    });
    return this.roomRepo.save(room);
  }

  async remove(id: string): Promise<void> {
    const room = await this.findOne(id);
    await this.roomRepo.remove(room);
  }

  getMembers(roomId: string): Promise<RoomMember[]> {
    return this.memberRepo.find({ where: { room_id: roomId } });
  }

  /**
   * room_id + user_id가 이미 있으면 role을 갱신(upsert), 없으면 insert.
   */
  async upsertMember(roomId: string, dto: AddMemberDto): Promise<RoomMember> {
    // 방 존재 확인
    await this.findOne(roomId);

    await this.memberRepo
      .createQueryBuilder()
      .insert()
      .into(RoomMember)
      .values({
        room_id: roomId,
        user_id: dto.user_id,
        role: dto.role ?? 'member',
      })
      .orUpdate(['role'], ['room_id', 'user_id'])
      .execute();

    const member = await this.memberRepo.findOne({
      where: { room_id: roomId, user_id: dto.user_id },
    });
    return member!;
  }

  async removeMember(roomId: string, userId: string): Promise<void> {
    const member = await this.memberRepo.findOne({
      where: { room_id: roomId, user_id: userId },
    });
    if (!member) throw new NotFoundException(`Member ${userId} not in room ${roomId}`);
    await this.memberRepo.remove(member);
  }

  /** room 존재 여부만 확인 (gateway용) */
  async exists(roomId: string): Promise<boolean> {
    const count = await this.roomRepo.count({ where: { id: roomId } });
    return count > 0;
  }
}
