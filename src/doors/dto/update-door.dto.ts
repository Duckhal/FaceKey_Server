import { PartialType } from '@nestjs/mapped-types';
import { CreateDoorDto } from './create-door.dto';

export class UpdateDoorDto extends PartialType(CreateDoorDto) {}
