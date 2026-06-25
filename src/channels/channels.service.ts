import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Channel } from './channel.entity';
import { CreateChannelDto } from './dto/create-channel.dto';

@Injectable()
export class ChannelsService {
  constructor(
    @InjectRepository(Channel)
    private readonly channelRepo: Repository<Channel>,
  ) {}

  findAll(): Promise<Channel[]> {
    return this.channelRepo.find({ order: { created_at: 'DESC' } });
  }

  async findOne(id: string): Promise<Channel> {
    const channel = await this.channelRepo.findOne({ where: { id } });
    if (!channel) throw new NotFoundException(`Channel ${id} not found`);
    return channel;
  }

  async findByMatchId(matchId: string): Promise<Channel> {
    const channel = await this.channelRepo.findOne({ where: { match_id: matchId } });
    if (!channel) throw new NotFoundException(`Channel with matchId ${matchId} not found`);
    return channel;
  }

  create(dto: CreateChannelDto): Promise<Channel> {
    const channel = this.channelRepo.create({
      match_id: dto.match_id,
      status: dto.status ?? 'scheduled',
      metadata: dto.metadata ?? {},
    });
    return this.channelRepo.save(channel);
  }

  async updateStatus(id: string, status: Channel['status']): Promise<Channel> {
    const channel = await this.findOne(id);
    channel.status = status;
    return this.channelRepo.save(channel);
  }

  async remove(id: string): Promise<void> {
    const channel = await this.findOne(id);
    await this.channelRepo.remove(channel);
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.channelRepo.count({ where: { id } });
    return count > 0;
  }
}
