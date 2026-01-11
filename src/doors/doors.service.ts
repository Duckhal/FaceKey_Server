import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
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

  // --- HÀM KIỂM TRA TRÙNG PIN ---
  private async checkPinConflict(
    lockDeviceId: number,
    gpioPin: number,
    excludeDoorId?: number,
  ) {
    const existingDoor = await this.doorsRepository.findOne({
      where: {
        lock_device_id: lockDeviceId,
        gpio_pin: gpioPin,
        ...(excludeDoorId ? { id: Not(excludeDoorId) } : {}),
      },
    });

    if (existingDoor) {
      throw new ConflictException(
        `GPIO Pin ${gpioPin} is already used by door "${existingDoor.name}" on this device.`,
      );
    }
  }

  // --- HÀM KIỂM TRA TRÙNG CAMERA (MỚI THÊM) ---
  private async checkCameraConflict(cameraId: number, excludeDoorId?: number) {
    if (!cameraId) return; // Nếu không gửi camera lên thì bỏ qua

    const existingDoor = await this.doorsRepository.findOne({
      where: {
        camera_device_id: cameraId,
        ...(excludeDoorId ? { id: Not(excludeDoorId) } : {}),
      },
    });

    if (existingDoor) {
      throw new ConflictException(
        `This camera is already assigned to door "${existingDoor.name}". Please choose another camera.`,
      );
    }
  }

  async create(createDoorDto: CreateDoorDto, userId: number) {
    // 1. Kiểm tra Lock Device
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

    // 2. KIỂM TRA TRÙNG PIN
    await this.checkPinConflict(
      createDoorDto.lock_device_id,
      createDoorDto.gpio_pin,
    );

    // 3. Kiểm tra Camera Device
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

      await this.checkCameraConflict(createDoorDto.camera_device_id);
    }

    // 4. Tạo cửa
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
    if (!door) throw new NotFoundException(`Not found`);
    return door;
  }

  async update(id: number, updateDoorDto: UpdateDoorDto, userId: number) {
    const door = await this.findOne(id, userId);
    const newLockId = updateDoorDto.lock_device_id ?? door.lock_device_id;
    const newPin = updateDoorDto.gpio_pin ?? door.gpio_pin;

    // Check trùng Pin
    if (
      updateDoorDto.lock_device_id !== undefined ||
      updateDoorDto.gpio_pin !== undefined
    ) {
      await this.checkPinConflict(newLockId, newPin, id);
    }

    // Check Camera
    if (updateDoorDto.camera_device_id) {
      const cam = await this.devicesRepository.findOne({
        where: {
          device_id: updateDoorDto.camera_device_id,
          user: { user_id: userId },
        },
      });
      if (!cam || cam.device_type !== DeviceType.CAM) {
        throw new BadRequestException('Invalid Camera Device');
      }

      await this.checkCameraConflict(updateDoorDto.camera_device_id, id);
    }

    // Check Lock Device
    if (updateDoorDto.lock_device_id) {
      const lock = await this.devicesRepository.findOne({
        where: {
          device_id: updateDoorDto.lock_device_id,
          user: { user_id: userId },
        },
      });
      if (!lock || lock.device_type !== DeviceType.LOCK) {
        throw new BadRequestException('Invalid Lock Device');
      }
    }

    Object.assign(door, updateDoorDto);
    return await this.doorsRepository.save(door);
  }

  async remove(id: number, userId: number) {
    const result = await this.doorsRepository.delete({
      id,
      user: { user_id: userId },
    });
    if (result.affected === 0) throw new NotFoundException(`Not found`);
    return { message: 'Door deleted successfully' };
  }
}
