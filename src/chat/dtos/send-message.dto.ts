// src/chat/dto/send-message.dto.ts
import { IsString, IsOptional, IsIn } from 'class-validator';

export class SendMessageDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  receiverId?: string;

  @IsOptional()
  @IsIn(['private', 'group'])
  type?: 'private' | 'group';
}
