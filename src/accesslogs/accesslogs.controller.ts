import { Controller, Delete, Get, UseGuards, Request } from '@nestjs/common';
import { AccesslogsService } from './accesslogs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('accesslogs')
@UseGuards(JwtAuthGuard)
export class AccesslogsController {
  constructor(private readonly accesslogsService: AccesslogsService) {}

  @Get()
  findAll(@Request() req) {
    return this.accesslogsService.findAll(req.user.userId);
  }

  @Delete('clear')
  clearAll(@Request() req) {
    return this.accesslogsService.clearAll(req.user.userId);
  }
}
