import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum DeviceType {
  CAM = 'CAM',
  LOCK = 'LOCK',
}

@Entity('devices')
export class Device {
  @PrimaryGeneratedColumn()
  device_id: number;

  @Column({ unique: true })
  device_uid: string; // MAC Address từ ESP32

  @Column()
  device_name: string;

  @Column({
    type: 'enum',
    enum: DeviceType,
    default: DeviceType.CAM,
  })
  device_type: DeviceType;

  // Liên kết với User
  @Column()
  user_id: number;

  @ManyToOne(() => User, (user) => user.devices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn()
  created_at: Date;
}
