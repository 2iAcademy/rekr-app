import {
  Body,
  Controller,
  Delete,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user.interface';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UPLOAD_BODY_SCHEMA } from '../storage/upload-body.schema';
import { UploadedFileInterceptor } from '../storage/upload-interceptor';
import type { UploadedFile as UploadedFileContent } from '../storage/uploaded-file.interface';
import { CompanyFileService } from './company-file.service';
import { CompanyService } from './company.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Controller('companies')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles('recruiter')
export class CompanyController {
  constructor(
    private readonly service: CompanyService,
    private readonly files: CompanyFileService,
  ) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCompanyDto) {
    return this.service.create(user.id, dto);
  }

  @Patch('mine')
  updateMine(@CurrentUser() user: AuthUser, @Body() dto: UpdateCompanyDto) {
    return this.service.updateMine(user.id, dto);
  }

  @Put('mine/logo')
  @UseInterceptors(UploadedFileInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiBody(UPLOAD_BODY_SCHEMA)
  replaceLogo(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: UploadedFileContent | undefined,
  ) {
    return this.files.replace(user.id, 'logo', file);
  }

  @Delete('mine/logo')
  removeLogo(@CurrentUser() user: AuthUser) {
    return this.files.remove(user.id, 'logo');
  }

  @Put('mine/cover-image')
  @UseInterceptors(UploadedFileInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiBody(UPLOAD_BODY_SCHEMA)
  replaceCoverImage(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: UploadedFileContent | undefined,
  ) {
    return this.files.replace(user.id, 'cover-image', file);
  }

  @Delete('mine/cover-image')
  removeCoverImage(@CurrentUser() user: AuthUser) {
    return this.files.remove(user.id, 'cover-image');
  }
}
