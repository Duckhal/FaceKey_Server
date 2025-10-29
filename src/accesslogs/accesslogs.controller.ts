import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AccesslogsService } from './accesslogs.service';
import { CreateAccesslogDto } from './dto/create-accesslog.dto';
import { UpdateAccesslogDto } from './dto/update-accesslog.dto';

@Controller('accesslogs')
export class AccesslogsController {
  constructor(private readonly accesslogsService: AccesslogsService) {}

  @Post()
  create(@Body() createAccesslogDto: CreateAccesslogDto) {
    return this.accesslogsService.create(createAccesslogDto);
  }

  @Get()
  findAll() {
    return this.accesslogsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.accesslogsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAccesslogDto: UpdateAccesslogDto) {
    return this.accesslogsService.update(+id, updateAccesslogDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.accesslogsService.remove(+id);
  }
}
