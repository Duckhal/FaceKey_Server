import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateDoorDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsNumber()
  lock_device_id: number;

  @IsOptional()
  @IsNumber()
  camera_device_id?: number;

  @IsNotEmpty()
  @IsNumber()
  gpio_pin: number;
}
