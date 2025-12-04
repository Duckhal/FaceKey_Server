import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Member } from '../../members/entities/member.entity';
import { User } from '../../users/entities/user.entity';

@Entity('facedata')
export class FaceData {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  user_id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' }) // Xóa User thì xóa luôn Log
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Member, (member) => member.faceData, { onDelete: 'CASCADE' })
  member: Member;

  @Column({ type: 'bytea' })
  face_encoding: Buffer;

  @Column({ nullable: true })
  image_url: string;

  @CreateDateColumn()
  created_at: Date;
}
