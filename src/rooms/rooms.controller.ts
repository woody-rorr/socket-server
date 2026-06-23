import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { AddMemberDto } from './dto/add-member.dto';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  /** GET /rooms */
  @Get()
  findAll() {
    return this.rooms.findAll();
  }

  /** POST /rooms */
  @Post()
  create(@Body() dto: CreateRoomDto) {
    return this.rooms.create(dto);
  }

  /** DELETE /rooms/:id */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.rooms.remove(id);
  }

  /** GET /rooms/:id/members */
  @Get(':id/members')
  getMembers(@Param('id') id: string) {
    return this.rooms.getMembers(id);
  }

  /** POST /rooms/:id/members */
  @Post(':id/members')
  addMember(@Param('id') id: string, @Body() dto: AddMemberDto) {
    return this.rooms.upsertMember(id, dto);
  }

  /** DELETE /rooms/:id/members/:userId */
  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.rooms.removeMember(id, userId);
  }
}
