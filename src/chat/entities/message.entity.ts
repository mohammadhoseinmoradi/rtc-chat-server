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

  @ManyToOne(() => User, { eager: true })
  sender: User;

  @Column()
  senderId: string;

  @Column('uuid', { nullable: true })
  receiverId: string;

  @Column({ default: 'private' })
  type: 'private' | 'group';

  @CreateDateColumn()
  timestamp: Date;

  @Column({ default: false })
  isRead: boolean;
}
