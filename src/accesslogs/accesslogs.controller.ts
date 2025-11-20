import { Controller, Delete, Get } from '@nestjs/common';
import { AccesslogsService } from './accesslogs.service';

@Controller('accesslogs')
export class AccesslogsController {
  constructor(private readonly accesslogsService: AccesslogsService) {}

  @Get()
  findAll() {
    return this.accesslogsService.findAll();
  }

  @Delete('clear')
  clearAll() {
    return this.accesslogsService.clearAll();
  }
}
