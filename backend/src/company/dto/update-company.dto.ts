import { PartialType } from '@nestjs/mapped-types';
import { CompanyFieldsDto } from './company-fields.dto';

export class UpdateCompanyDto extends PartialType(CompanyFieldsDto) {}
