import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn } from 'typeorm';
import { Member } from '../../members/entities/member.entity';

@Entity('facedata')
export class FaceData {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Member, (member) => member.faceData, { onDelete: 'CASCADE' })
  member: Member;

  @Column({ type: 'bytea' })
  face_encoding: Buffer;

  @Column({ nullable: true })
  image_url: string;

  @CreateDateColumn()
  created_at: Date;
}

