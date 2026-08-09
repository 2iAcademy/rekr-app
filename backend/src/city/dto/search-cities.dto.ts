import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { NoControlCharacters } from '../../common/validation/no-control-characters';

// The reference itself refuses a query shorter than three characters, and the
// column it feeds is `@db.VarChar(100)`.
export class SearchCitiesDto {
  // Spelled out for Swagger: without it the query parameter is absent from the
  // spec, and the generated client offers no way to send it.
  @ApiProperty({ example: 'lyon', minLength: 3, maxLength: 100 })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @NoControlCharacters()
  q!: string;
}
