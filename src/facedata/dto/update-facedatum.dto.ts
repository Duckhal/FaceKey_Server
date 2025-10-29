import { PartialType } from '@nestjs/mapped-types';
import { CreateFacedatumDto } from './create-facedatum.dto';

export class UpdateFacedatumDto extends PartialType(CreateFacedatumDto) {}
