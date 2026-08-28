import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { Availability } from '../../../generated/prisma/client';
import { FeedQueryDto } from '../../common/feed/feed-query.dto';

export class CandidateFeedQueryDto extends FeedQueryDto {
  @ApiPropertyOptional({
    enum: Availability,
    enumName: 'Availability',
    description: 'Ne garder que les candidats de cette disponibilité.',
  })
  @IsOptional()
  @IsEnum(Availability)
  availability?: Availability;
}
