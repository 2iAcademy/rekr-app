import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { MAX_PASSWORD_LENGTH } from 'src/common/validation/password-bounds';

/**
 * The password again, even with a valid token in hand: an access token left in
 * an unlocked browser must not be enough to erase an account for good.
 */
export class DeleteAccountDto {
  @ApiProperty({ example: 'correct-horse-battery-staple' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_PASSWORD_LENGTH)
  password!: string;
}
