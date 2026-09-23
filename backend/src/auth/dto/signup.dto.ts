import { Transform } from 'class-transformer';
import {
  Equals,
  IsEmail,
  IsIn,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { normalizeEmail } from 'src/common/transforms/emails.transforms';
import { MAX_PASSWORD_LENGTH } from 'src/common/validation/password-bounds';
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
    example: 'correct-horse-battery-staple',
    minLength: 8,
    maxLength: MAX_PASSWORD_LENGTH,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(MAX_PASSWORD_LENGTH)
  password!: string;

  @ApiProperty({
    enum: allowedUserTypes,
  })
  @Transform(({ value }) => normalizeUserType(value))
  @IsIn(allowedUserTypes)
  userType!: (typeof allowedUserTypes)[number];

  /**
   * The sign-up form's checkbox, repeated to the server: a consent that only
   * the client checked is one the server cannot prove it collected. `true`
   * exactly — not `"true"`, not `1` — since the global pipe does not coerce.
   */
  @ApiProperty({
    enum: [true],
    description: 'Acceptance of the privacy policy and the terms of use.',
  })
  @Equals(true, { message: 'The privacy policy must be accepted.' })
  acceptTerms!: true;
}
