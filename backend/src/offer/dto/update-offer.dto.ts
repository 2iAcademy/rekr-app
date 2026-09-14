import { PartialType } from '@nestjs/swagger';
import { CreateOfferDto } from './create-offer.dto';

// `PartialType` from `@nestjs/swagger`, not from `@nestjs/mapped-types`: the
// latter carries the validation decorators over but drops the `@ApiProperty`
// metadata, so the generated schema was an empty object and every client
// typed this payload as `Record<string, unknown>`.
export class UpdateOfferDto extends PartialType(CreateOfferDto) {}
