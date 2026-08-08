import { ApiProperty } from '@nestjs/swagger';

export class SectorDto {
  @ApiProperty({ example: 12 })
  id!: number;

  @ApiProperty({ example: 'Informatique & Numérique', maxLength: 100 })
  label!: string;
}
