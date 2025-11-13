import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { FaceData } from '../../facedata/entities/facedata.entity';
import { AccessLog } from '../../accesslogs/entities/accesslog.entity';

@Entity('members')
export class Member {
  @PrimaryGeneratedColumn()
  member_id: number;

  @Column()
  name: string;

  @Column()
  role: string;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => FaceData, (faceData) => faceData.member, {
    onDelete: 'CASCADE',
  })
  faceData: FaceData[];

  @OneToMany(() => AccessLog, (log) => log.member)
  accessLogs: AccessLog[];
}

