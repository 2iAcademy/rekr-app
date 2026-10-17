import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiProperty,
} from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import type { AuthUser } from '../auth/auth-user.interface';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SwipeEventsService } from './swipe-events.service';

export class ImpressionDto {
  @ApiProperty({ minimum: 1, maximum: 100 })
  @IsInt()
  @Min(1)
  @Max(100)
  position!: number;
}

@Controller('data/offers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('candidate')
@ApiBearerAuth()
export class ImpressionController {
  constructor(private readonly events: SwipeEventsService) {}

  @Post(':id/impression')
  @HttpCode(204)
  @ApiNoContentResponse({
    description: 'Signal de visibilité accepté (collecte locale best effort).',
  })
  record(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ImpressionDto,
  ): void {
    this.events.impression(user.id, id, dto.position);
  }
}
