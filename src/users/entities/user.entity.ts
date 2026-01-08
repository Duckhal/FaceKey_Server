import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Member } from '../../members/entities/member.entity';
import { Device } from 'src/devices/entities/device.entity';
import { Door } from 'src/doors/entities/door.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  user_id: number;

  @Column({ nullable: true })
  username: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @OneToMany(() => Member, (member) => member.user)
  members: Member[];

  @OneToMany(() => Device, (device) => device.user)
  devices: Device[];

  @OneToMany(() => Door, (door) => door.user)
  doors: Door[];

  @Column({ type: 'varchar', nullable: true })
  reset_otp: string | null;

  @Column({ type: 'timestamp', nullable: true })
  reset_otp_expiry: Date | null;
}
