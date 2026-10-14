import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { normalizeEmail } from 'src/common/transforms/emails.transforms';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'user@example.com',
  })
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail()
  email!: string;

  // Not MIN_PASSWORD_LENGTH: accounts created before the 12-character rule
  // must still be able to sign in with their 8-character password.
  @ApiProperty({
    example: 'password123',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password!: string;
}
