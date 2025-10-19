// src/chat/entities/message.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../../users/user.entity';

@Entity()
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  content: string;

  @ManyToOne(() => User, { eager: true }) // eager: true یعنی user رو خودش load کنه
  sender: User;

  @Column()
  senderId: string;

  @Column({ nullable: true })
  receiverId: string; // اگر null باشد پیام عمومی است

  @Column({ default: 'private' })
  type: 'private' | 'group';

  @CreateDateColumn()
  timestamp: Date;

  @Column({ default: false })
  isRead: boolean;
}
