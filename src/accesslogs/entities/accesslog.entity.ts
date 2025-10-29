import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn } from 'typeorm';
import { Member } from '../../members/entities/member.entity';

@Entity('accesslogs')
export class AccessLog {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Member, (member) => member.accessLogs, { nullable: true, onDelete: 'SET NULL' })
  member: Member;

  @Column({ nullable: true })
  member_name_snapshot: string;

  @Column({
    type: 'enum',
    enum: ['granted', 'denied_unrecognized'],
  })
  action: 'granted' | 'denied_unrecognized';

  @Column({ nullable: true })
  snapshot_url: string;

  @CreateDateColumn()
  timestamp: Date;
}

