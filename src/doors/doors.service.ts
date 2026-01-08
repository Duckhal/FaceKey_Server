import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Door } from './entities/door.entity';
import { CreateDoorDto } from './dto/create-door.dto';
import { UpdateDoorDto } from './dto/update-door.dto';
import { Device, DeviceType } from '../devices/entities/device.entity';

@Injectable()
export class DoorsService {
  constructor(
    @InjectRepository(Door)
    private doorsRepository: Repository<Door>,
    @InjectRepository(Device)
    private devicesRepository: Repository<Device>,
  ) {}

  async create(createDoorDto: CreateDoorDto, userId: number) {
    // 1. Kiểm tra Lock Device có tồn tại và thuộc về User không
    const lock = await this.devicesRepository.findOne({
      where: {
        device_id: createDoorDto.lock_device_id,
        user: { user_id: userId },
      },
    });

    if (!lock || lock.device_type !== DeviceType.LOCK) {
      throw new BadRequestException(
        'Invalid Lock Device or Device not owned by user',
      );
    }

    // 2. Kiểm tra Camera Device (nếu có)
    if (createDoorDto.camera_device_id) {
      const cam = await this.devicesRepository.findOne({
        where: {
          device_id: createDoorDto.camera_device_id,
          user: { user_id: userId },
        },
      });
      if (!cam || cam.device_type !== DeviceType.CAM) {
        throw new BadRequestException('Invalid Camera Device');
      }
    }

    // 3. Tạo cửa
    const newDoor = this.doorsRepository.create({
      ...createDoorDto,
      user: { user_id: userId },
    });

    return await this.doorsRepository.save(newDoor);
  }

  async findAll(userId: number) {
    return await this.doorsRepository.find({
      where: { user: { user_id: userId } },
      relations: ['lockDevice', 'cameraDevice'],
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: number, userId: number) {
    const door = await this.doorsRepository.findOne({
      where: { id, user: { user_id: userId } },
      relations: ['lockDevice', 'cameraDevice'],
    });
    if (!door) throw new NotFoundException(`Door #${id} not found`);
    return door;
  }

  async update(id: number, updateDoorDto: UpdateDoorDto, userId: number) {
    const door = await this.findOne(id, userId);

    Object.assign(door, updateDoorDto);
    return await this.doorsRepository.save(door);
  }

  async remove(id: number, userId: number) {
    const result = await this.doorsRepository.delete({
      id,
      user: { user_id: userId },
    });
    if (result.affected === 0)
      throw new NotFoundException(`Door #${id} not found`);
    return { message: 'Door deleted successfully' };
  }
}
