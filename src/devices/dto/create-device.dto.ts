import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { DeviceType } from '../entities/device.entity';

export class CreateDeviceDto {
  @IsNotEmpty()
  @IsString()
  device_uid: string; // Mac address

  @IsNotEmpty()
  @IsString()
  device_name: string; // device name

  @IsNotEmpty()
  @IsEnum(DeviceType)
  device_type: DeviceType; // 'CAM' or 'LOCK'
}
