import { Injectable } from '@nestjs/common';
import { CreateAccesslogDto } from './dto/create-accesslog.dto';
import { UpdateAccesslogDto } from './dto/update-accesslog.dto';

@Injectable()
export class AccesslogsService {
  create(createAccesslogDto: CreateAccesslogDto) {
    return 'This action adds a new accesslog';
  }

  findAll() {
    return `This action returns all accesslogs`;
  }

  findOne(id: number) {
    return `This action returns a #${id} accesslog`;
  }

  update(id: number, updateAccesslogDto: UpdateAccesslogDto) {
    return `This action updates a #${id} accesslog`;
  }

  remove(id: number) {
    return `This action removes a #${id} accesslog`;
  }
}
