import { ApiProperty } from '@nestjs/swagger';

export class JobFamilyDto {
  @ApiProperty({ example: 13 })
  id!: number;

  @ApiProperty({ example: 'Informatique & Numérique', maxLength: 100 })
  label!: string;
}
