import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthUser } from '../auth/auth-user.interface';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { clearRefreshCookie } from '../auth/refresh-cookie';
import { ThrottleScope } from '../common/throttling/throttle-scope.decorator';
import { AccountService } from './account.service';
import { DeleteAccountDto } from './dto/delete-account.dto';

/**
 * The account as a whole, whatever its type: no `RolesGuard` here, since both
 * rights are everybody's. Each route reads the user from the token and names
 * no one, so there is no identifier to point at another account.
 */
@ApiTags('account')
@Controller('account')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AccountController {
  constructor(private readonly service: AccountService) {}

  /**
   * The refresh cookie is cleared as well, although the tokens behind it are
   * already gone with the account: a dead cookie left in the browser would
   * only make the next boot fail its refresh for nothing.
   */
  @Delete()
  @HttpCode(204)
  @ThrottleScope('accountDelete')
  @ApiNoContentResponse()
  async delete(
    @CurrentUser() user: AuthUser,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.service.delete(user.id, dto.password);
    clearRefreshCookie(res);
  }

  /**
   * A download rather than a page: the point is a copy the user keeps. The
   * body is pretty-printed because a person, not a program, is its reader.
   */
  @Get('export')
  @Header('Content-Type', 'application/json; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ schema: { type: 'object' } })
  async export(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const data = await this.service.export(user.id);
    const day = data.exportedAt.slice(0, 10);

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="rekr-export-${day}.json"`,
    );

    return JSON.stringify(data, null, 2);
  }
}
