import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { MAX_PASSWORD_LENGTH } from 'src/common/validation/password-bounds';

/** The token is not bounded further than being a string: the shape it takes is
 * an implementation detail of the issuer, and a stricter rule here would refuse
 * a link the service could still recognise. Only the digest lookup decides. */
export class ResetPasswordDto {
  @ApiProperty({
    description: 'Jeton reçu par e-mail, tel qu’il figure dans le lien.',
  })
  @IsString()
  token!: string;

  @ApiProperty({
    example: 'correct-horse-battery-staple',
    minLength: 8,
    maxLength: MAX_PASSWORD_LENGTH,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(MAX_PASSWORD_LENGTH)
  password!: string;
}
