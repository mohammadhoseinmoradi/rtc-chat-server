// src/chat/dto/chat-history.dto.ts
import { IsOptional, IsString, IsIn } from 'class-validator';

export class ChatHistoryDto {
  @IsOptional()
  @IsString()
  otherUserId?: string;

  @IsOptional()
  @IsIn(['private', 'group'])
  type?: 'private' | 'group';
}
