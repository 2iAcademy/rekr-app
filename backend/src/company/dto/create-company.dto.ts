import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CompanyFieldsDto } from './company-fields.dto';

export class CreateCompanyDto extends CompanyFieldsDto {
  @IsString()
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MaxLength(100)
  lastName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  jobTitle?: string;
}
