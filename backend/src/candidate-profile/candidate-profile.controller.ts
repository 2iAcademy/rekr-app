import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Put,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
} from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user.interface';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UPLOAD_BODY_SCHEMA } from '../storage/upload-body.schema';
import { UploadedFileInterceptor } from '../storage/upload-interceptor';
import type { UploadedFile as UploadedFileContent } from '../storage/uploaded-file.interface';
import { CandidateProfileFileService } from './candidate-profile-file.service';
import { CandidateProfileService } from './candidate-profile.service';
import { CandidateFeedItemDto } from './dto/candidate-feed-item.dto';
import { CandidateFeedQueryDto } from './dto/candidate-feed-query.dto';
import { CandidateProfileResponseDto } from './dto/candidate-profile-response.dto';
import { CreateCandidateProfileDto } from './dto/create-candidate-profile.dto';
import { UpdateCandidateProfileDto } from './dto/update-candidate-profile.dto';

@Controller('candidate-profiles')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles('candidate')
export class CandidateProfileController {
  constructor(
    private readonly service: CandidateProfileService,
    private readonly files: CandidateProfileFileService,
  ) {}

  // On its own path rather than at the collection root: `GET
  // /candidate-profiles` is the collection, the deck is a distinct resource.
  // The class-level `@Roles('candidate')` is overridden here: the deck of
  // candidates is what a recruiter swipes, not what a candidate reads.
  @Get('feed')
  @Roles('recruiter')
  @ApiOkResponse({ type: CandidateFeedItemDto, isArray: true })
  findFeed(
    @CurrentUser() user: AuthUser,
    @Query() query: CandidateFeedQueryDto,
  ): Promise<CandidateFeedItemDto[]> {
    return this.service.findFeed(user.id, query);
  }

  @Get('me')
  @ApiOkResponse({ type: CandidateProfileResponseDto })
  findMine(
    @CurrentUser() user: AuthUser,
  ): Promise<CandidateProfileResponseDto> {
    return this.service.findMine(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCandidateProfileDto,
  ) {
    return this.service.create(user.id, dto);
  }

  @Patch('me')
  update(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateCandidateProfileDto,
  ) {
    return this.service.update(user.id, dto);
  }

  @Put('me/picture')
  @UseInterceptors(UploadedFileInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiBody(UPLOAD_BODY_SCHEMA)
  replacePicture(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: UploadedFileContent | undefined,
  ) {
    return this.files.replace(user.id, 'picture', file);
  }

  @Delete('me/picture')
  removePicture(@CurrentUser() user: AuthUser) {
    return this.files.remove(user.id, 'picture');
  }

  @Put('me/cv')
  @UseInterceptors(UploadedFileInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiBody(UPLOAD_BODY_SCHEMA)
  replaceCv(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: UploadedFileContent | undefined,
  ) {
    return this.files.replace(user.id, 'cv', file);
  }

  @Delete('me/cv')
  removeCv(@CurrentUser() user: AuthUser) {
    return this.files.remove(user.id, 'cv');
  }

  /**
   * The only way to read a CV. It names no key and no user: the row comes from
   * the token, so there is no parameter to tamper with and no sibling row to
   * reach. This is what "CV protégé" means here, and why the public
   * `/api/files` route refuses the `cv` kind outright.
   */
  @Get('me/cv')
  async readCv(@CurrentUser() user: AuthUser): Promise<StreamableFile> {
    const { content, contentType } = await this.files.readCv(user.id);

    // `attachment`, never `inline`: a PDF rendered in the browser executes its
    // own scripting, and this one was uploaded by a user.
    return new StreamableFile(content, {
      type: contentType,
      disposition: 'attachment; filename="cv.pdf"',
    });
  }
}
