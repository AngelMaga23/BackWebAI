import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';

import { ApplicationsService } from './applications.service';
import { ApplicationsController } from './applications.controller';
import { Application } from './entities/application.entity';
import { ApplicationstatusModule } from '../applicationstatus/applicationstatus.module';
import { SourcecodeModule } from '../sourcecode/sourcecode.module';

import { AuthModule } from '../auth/auth.module';
import { CommonModule } from 'src/common/common.module';

@Module({
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  imports:[
    TypeOrmModule.forFeature([ Application ]),
    ApplicationstatusModule,
    SourcecodeModule,
    HttpModule,
    AuthModule,
    CommonModule
  ],
  exports:[ ApplicationsService,TypeOrmModule ]
})
export class ApplicationsModule {}
