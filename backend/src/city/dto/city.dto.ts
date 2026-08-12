import { ApiProperty } from '@nestjs/swagger';

export class CityDto {
  @ApiProperty({ example: 'Lyon 3e Arrondissement', maxLength: 100 })
  name!: string;

  @ApiProperty({ example: '69003', maxLength: 10 })
  postalCode!: string;

  @ApiProperty({ example: 45.751578 })
  latitude!: number;

  @ApiProperty({ example: 4.869577 })
  longitude!: number;
}
