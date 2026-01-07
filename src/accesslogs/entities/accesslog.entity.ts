import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Member } from '../../members/entities/member.entity';
import { User } from 'src/users/entities/user.entity';

export enum AccessAction {
  GRANTED = 'granted',
  DENIED = 'denied_unrecognized',
  GRANTED_REMOTE = 'granted_remote',
}

@Entity('accesslogs')
export class AccessLog {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Member, (member) => member.accessLogs, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'member_id' })
  member: Member;

  @Column({ nullable: true })
  member_name_snapshot: string;

  @Column({
    type: 'enum',
    enum: AccessAction,
    default: AccessAction.DENIED,
  })
  action: AccessAction;

  @Column({ nullable: true })
  snapshot_url: string;

  @CreateDateColumn()
  timestamp: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
