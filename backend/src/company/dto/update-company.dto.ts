import { PartialType } from '@nestjs/mapped-types';
import { CreateCompanyDto } from './create-company.dto';

/**
 * Derived from the create DTO, not from `CompanyFieldsDto`: the recruiter's own
 * identity is written on creation and would otherwise have no way back. A
 * recruiter re-running the onboarding wizard sends the whole form, and
 * `forbidNonWhitelisted` would answer 400 on `firstName` alone.
 */
export class UpdateCompanyDto extends PartialType(CreateCompanyDto) {}
