import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfiguracionService } from './configuracion.service';
import { Configuracion } from './entities/configuracion.entity';
import { ConfiguracionController } from './configuracion.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Configuracion])],
  // controllers: [ConfiguracionController],
  providers: [ConfiguracionService],
  exports: [TypeOrmModule, ConfiguracionService],
})
export class ConfiguracionModule {}
