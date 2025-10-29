import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { FaceData } from '../../facedata/entities/facedata.entity';
import { AccessLog } from '../../accesslogs/entities/accesslog.entity';

@Entity('members')
export class Member {
  @PrimaryGeneratedColumn()
  member_id: number;

  @Column()
  name: string;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => FaceData, (faceData) => faceData.member)
  faceData: FaceData[];

  @OneToMany(() => AccessLog, (log) => log.member)
  accessLogs: AccessLog[];
}

