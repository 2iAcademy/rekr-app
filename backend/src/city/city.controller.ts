import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ThrottleScope } from '../common/throttling/throttle-scope.decorator';
import { CityService } from './city.service';
import { CityDto } from './dto/city.dto';
import { SearchCitiesDto } from './dto/search-cities.dto';

@Controller('cities')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CityController {
  constructor(private readonly service: CityService) {}

  // Reference data, not owned by anyone: both journeys type a city, so the
  // route is authenticated but not restricted to a user type.
  @Get()
  @ThrottleScope('cities')
  @ApiOkResponse({ type: [CityDto] })
  search(@Query() query: SearchCitiesDto): Promise<CityDto[]> {
    return this.service.search(query.q);
  }
}
