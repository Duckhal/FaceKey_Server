import {
  Injectable,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { Device } from './entities/device.entity';

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
  ) {}

  // Register a new device
  async create(createDeviceDto: CreateDeviceDto, userId: number) {
    // Check if device with same MAC address already exists
    const existingDevice = await this.deviceRepository.findOne({
      where: { device_uid: createDeviceDto.device_uid },
    });

    if (existingDevice) {
      throw new ConflictException(
        'This device (MAC Address) is already registered!',
      );
    }

    // 2. Create a new device and associate it with the User
    const newDevice = this.deviceRepository.create({
      ...createDeviceDto,
      user: { user_id: userId }, // Associate owner
    });

    try {
      return await this.deviceRepository.save(newDevice);
    } catch (error) {
      throw new InternalServerErrorException(
        'Error saving device to the database',
      );
    }
  }

  /**
   * Get list of devices for that USER
   */
  async findAll(userId: number) {
    return await this.deviceRepository.find({
      where: { user: { user_id: userId } },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Get details of a device (Must belong to the owner)
   */
  async findOne(id: number, userId: number) {
    const device = await this.deviceRepository.findOne({
      where: {
        device_id: id,
        user: { user_id: userId },
      },
    });

    if (!device) {
      throw new NotFoundException(`Device #${id} not found`);
    }
    return device;
  }

  /**
   * Update device name
   */
  async update(id: number, updateDeviceDto: UpdateDeviceDto, userId: number) {
    // Find device first to check if it belongs to this user
    const device = await this.findOne(id, userId);

    // Update information (Only allow updating name, not MAC or Type to avoid system errors)
    if (updateDeviceDto.device_name) {
      device.device_name = updateDeviceDto.device_name;
    }

    return await this.deviceRepository.save(device);
  }

  /**
   * Delete a device
   */
  async remove(id: number, userId: number) {
    const result = await this.deviceRepository.delete({
      device_id: id,
      user: { user_id: userId },
    });

    if (result.affected === 0) {
      throw new NotFoundException(`Device #${id} not found for deletion`);
    }

    return { message: 'Device deleted successfully' };
  }
}
