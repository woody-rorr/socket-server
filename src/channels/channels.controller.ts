import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { Channel } from './channel.entity';

@Controller('channels')
export class ChannelsController {
  constructor(private readonly channels: ChannelsService) {}

  /** GET /channels */
  @Get()
  findAll() {
    return this.channels.findAll();
  }

  /** POST /channels */
  @Post()
  create(@Body() dto: CreateChannelDto) {
    return this.channels.create(dto);
  }

  /** GET /channels/:id */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.channels.findOne(id);
  }

  /** PATCH /channels/:id/status */
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: Channel['status']) {
    return this.channels.updateStatus(id, status);
  }

  /** DELETE /channels/:id */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.channels.remove(id);
  }
}
