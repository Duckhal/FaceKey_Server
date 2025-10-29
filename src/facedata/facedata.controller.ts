import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { FacedataService } from './facedata.service';
import { CreateFacedatumDto } from './dto/create-facedatum.dto';
import { UpdateFacedatumDto } from './dto/update-facedatum.dto';

@Controller('facedata')
export class FacedataController {
  constructor(private readonly facedataService: FacedataService) {}

  @Post()
  create(@Body() createFacedatumDto: CreateFacedatumDto) {
    return this.facedataService.create(createFacedatumDto);
  }

  @Get()
  findAll() {
    return this.facedataService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.facedataService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateFacedatumDto: UpdateFacedatumDto) {
    return this.facedataService.update(+id, updateFacedatumDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.facedataService.remove(+id);
  }
}
