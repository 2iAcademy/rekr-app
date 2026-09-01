import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createMailSender } from './mail-sender.factory';
import { MAIL_SENDER } from './mail-sender.interface';

@Module({
  providers: [
    {
      provide: MAIL_SENDER,
      inject: [ConfigService],
      useFactory: createMailSender,
    },
  ],
  exports: [MAIL_SENDER],
})
export class MailModule {}
