import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { DoorsService } from './doors.service';
import { CreateDoorDto } from './dto/create-door.dto';
import { UpdateDoorDto } from './dto/update-door.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('doors')
@UseGuards(JwtAuthGuard)
export class DoorsController {
  constructor(private readonly doorsService: DoorsService) {}

  @Post()
  create(@Body() createDoorDto: CreateDoorDto, @Request() req) {
    return this.doorsService.create(createDoorDto, req.user.userId);
  }

  @Get()
  findAll(@Request() req) {
    return this.doorsService.findAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.doorsService.findOne(+id, req.user.userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDoorDto: UpdateDoorDto,
    @Request() req,
  ) {
    return this.doorsService.update(+id, updateDoorDto, req.user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.doorsService.remove(+id, req.user.userId);
  }
}
