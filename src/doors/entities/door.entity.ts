import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Device } from '../../devices/entities/device.entity';

@Entity('doors')
export class Door {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  gpio_pin: number;

  @ManyToOne(() => Device, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'lock_device_id' })
  lockDevice: Device;

  @Column({ nullable: true })
  lock_device_id: number;

  @OneToOne(() => Device, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'camera_device_id' })
  cameraDevice: Device;

  @Column({ nullable: true })
  camera_device_id: number;

  @ManyToOne(() => User, (user) => user.doors, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  user_id: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
