import { Injectable } from '@nestjs/common';
import { CreateFacedatumDto } from './dto/create-facedatum.dto';
import { UpdateFacedatumDto } from './dto/update-facedatum.dto';

@Injectable()
export class FacedataService {
  create(createFacedatumDto: CreateFacedatumDto) {
    return 'This action adds a new facedatum';
  }

  findAll() {
    return `This action returns all facedata`;
  }

  findOne(id: number) {
    return `This action returns a #${id} facedatum`;
  }

  update(id: number, updateFacedatumDto: UpdateFacedatumDto) {
    return `This action updates a #${id} facedatum`;
  }

  remove(id: number) {
    return `This action removes a #${id} facedatum`;
  }
}
