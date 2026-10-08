import {
  Controller,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user.interface';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ChatService } from './chat.service';
import { ChatTokenDto } from './dto/chat-token.dto';
import { MatchChannelDto } from './dto/match-channel.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles('candidate', 'recruiter')
@ApiUnauthorizedResponse({ description: 'Jeton absent ou invalide.' })
@ApiForbiddenResponse({ description: 'Le rôle appelant n’a pas accès.' })
@ApiServiceUnavailableResponse({ description: 'Messagerie non configurée.' })
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post('chat/token')
  @HttpCode(200)
  @ApiOkResponse({ type: ChatTokenDto })
  issueToken(@CurrentUser() user: AuthUser): Promise<ChatTokenDto> {
    return this.chat.issueToken(user);
  }

  // A POST because it may create the channel and add the caller to it; calling
  // it again on an open conversation changes nothing.
  @Post('matches/:id/chat')
  @HttpCode(200)
  @ApiOkResponse({ type: MatchChannelDto })
  @ApiNotFoundResponse({
    description: 'Match inexistant, ou hors du périmètre de l’appelant.',
  })
  openMatchChannel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<MatchChannelDto> {
    return this.chat.openMatchChannel(user, id);
  }
}
