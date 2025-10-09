import { Controller, Get, Post, Body, Param, Delete, Patch } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  getAll(): Promise<User[]> {
    return this.usersService.findAll();
  }

  @Get(':id')
  getOne(@Param('id') id: number): Promise<User | null> {
    return this.usersService.findOne(id);
  }

  @Post()
  create(@Body() body: Partial<User>): Promise<User> {
    return this.usersService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: number, @Body() body: Partial<User>): Promise<User | null> {
    return this.usersService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: number): Promise<void> {
    return this.usersService.remove(id);
  }
}
