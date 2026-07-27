import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import { normalizeEmail } from 'src/common/transforms/emails.transforms';
import { ApiProperty } from '@nestjs/swagger';

const allowedUserTypes = ['candidate', 'recruiter'] as const;

const normalizeUserType = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === 'candidat') {
    return 'candidate';
  }

  if (normalized === 'recruteur') {
    return 'recruiter';
  }

  return normalized;
};

export class SignupDto {
  @ApiProperty({
    example: 'user@example.com',
  })
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'password123',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({
    enum: allowedUserTypes,
  })
  @Transform(({ value }) => normalizeUserType(value))
  @IsIn(allowedUserTypes)
  userType!: (typeof allowedUserTypes)[number];
}
