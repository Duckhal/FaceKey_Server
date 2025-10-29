import { PartialType } from '@nestjs/mapped-types';
import { CreateAccesslogDto } from './create-accesslog.dto';

export class UpdateAccesslogDto extends PartialType(CreateAccesslogDto) {}
