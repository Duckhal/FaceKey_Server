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
  @Column()
  device_uid: string;

  @Column()
  device_name: string;

  @Column({
    type: 'enum',
    enum: DeviceType,
    default: DeviceType.LOCK,
  })
  device_type: DeviceType;

  @Column({ nullable: true })
  camera_uid: string;

  @Column({ default: 13 })
  gpio_pin: number;

  @Column()
  user_id: number;

  @ManyToOne(() => User, (user) => user.devices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn()
  created_at: Date;
}
