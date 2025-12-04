import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Member } from '../../members/entities/member.entity';

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

  @Column({ type: 'varchar', nullable: true })
  reset_otp: string | null;

  @Column({ type: 'timestamp', nullable: true })
  reset_otp_expiry: Date | null;
}
