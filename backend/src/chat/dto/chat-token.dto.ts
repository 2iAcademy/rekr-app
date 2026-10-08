import { ApiProperty } from '@nestjs/swagger';

/**
 * What the browser needs to connect to Stream. The API key is public by
 * design; serving it here spares the frontend a build-time variable.
 */
export class ChatTokenDto {
  @ApiProperty({ example: 'a1b2c3d4e5f6' })
  apiKey!: string;

  @ApiProperty({ example: '42', description: 'Identifiant Stream du lecteur.' })
  userId!: string;

  @ApiProperty({ description: 'Jeton Stream signé pour ce lecteur.' })
  token!: string;
}
