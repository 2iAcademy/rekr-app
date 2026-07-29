import { IsOptional, IsString, MaxLength } from 'class-validator';
import { NoControlCharacters } from '../../common/validation/no-control-characters';

const MAX_MESSAGE_LENGTH = 2000;

export class PublishErrorLogDto {
  @IsOptional()
  @IsString()
  @MaxLength(MAX_MESSAGE_LENGTH)
  @NoControlCharacters()
  message?: string;
}
