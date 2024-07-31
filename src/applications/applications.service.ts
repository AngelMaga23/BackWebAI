import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import * as archiver from 'archiver';
import { CreateApplicationDto } from './dto/create-application.dto';
import { Application } from './entities/application.entity';
import {  Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ApplicationstatusService } from '../applicationstatus/applicationstatus.service';
import { SourcecodeService } from '../sourcecode/sourcecode.service';
import { catchError, lastValueFrom } from 'rxjs';
import { createReadStream, existsSync, mkdirSync, unlinkSync } from 'fs';
import  { join } from 'path';
import * as unzipper from 'unzipper';
import { User } from '../auth/entities/user.entity';
import { ValidRoles } from '../auth/interfaces/valid-roles';
import { CommonService } from 'src/common/common.service';

@Injectable()
export class ApplicationsService {

  private readonly logger = new Logger('ApplicationsService');

  private downloadPath = '/tmp/bito';
  // private readonly basePath = join(__dirname, '..', '..', '');
  private readonly basePath = '';

  constructor(
    @InjectRepository(Application)
    private readonly applicationRepository: Repository<Application>,
    private readonly estatusService: ApplicationstatusService,
    private readonly sourcecodeService: SourcecodeService,
    private readonly httpService: HttpService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private readonly encryptionService: CommonService
  ){
    // this.ensureDirectoryExists(this.downloadPath);
  }

  async findAll(user: User) {

    if( user.position !== null && user.position.nom_puesto == ValidRoles.admin  ){

      const aplicaciones = await this.applicationRepository.find();

      aplicaciones.map(aplicacion => {
        aplicacion.nom_aplicacion = this.encryptionService.decrypt(aplicacion.nom_aplicacion);
        aplicacion.applicationstatus.des_estatus_aplicacion = this.encryptionService.decrypt(aplicacion.applicationstatus.des_estatus_aplicacion);
        aplicacion.sourcecode.nom_codigo_fuente = this.encryptionService.decrypt(aplicacion.sourcecode.nom_codigo_fuente);
        aplicacion.sourcecode.nom_directorio = this.encryptionService.decrypt(aplicacion.sourcecode.nom_directorio);
        aplicacion.user.nom_usuario = this.encryptionService.decrypt(aplicacion.user.nom_usuario);
        return aplicaciones;
      });

      return aplicaciones;
    }

    const aplicaciones = await this.applicationRepository.find({
      where: { user: { idu_usuario: user.idu_usuario } },
    });

    aplicaciones.map(aplicacion => {
      aplicacion.nom_aplicacion = this.encryptionService.decrypt(aplicacion.nom_aplicacion);
      aplicacion.applicationstatus.des_estatus_aplicacion = this.encryptionService.decrypt(aplicacion.applicationstatus.des_estatus_aplicacion);
      aplicacion.sourcecode.nom_codigo_fuente = this.encryptionService.decrypt(aplicacion.sourcecode.nom_codigo_fuente);
      aplicacion.sourcecode.nom_directorio = this.encryptionService.decrypt(aplicacion.sourcecode.nom_directorio);
      aplicacion.user.nom_usuario = this.encryptionService.decrypt(aplicacion.user.nom_usuario);
      return aplicaciones;
    });

    return aplicaciones;
  }

    async createGitFile(createApplicationDto: CreateApplicationDto, user: User)
    {

      try {
        const repoName = this.getRepoName(createApplicationDto.url);
        const repoUserName = this.getUserName(createApplicationDto.url);

        // Generar una carpeta para el repositorio
        const repoFolderPath = join(this.downloadPath,repoName);
        mkdirSync(repoFolderPath, { recursive: true });

        const zipUrl = `https://github.com/${repoUserName}/${repoName}/archive/refs/heads/main.zip`;

        const response = await lastValueFrom(
          this.httpService.get(zipUrl, { responseType: 'stream' }).pipe(
            catchError((err) => {
              throw new InternalServerErrorException('Error al descargar el repositorio');
            }),
          ),
        );

     
        await response.data.pipe(unzipper.Extract({ path: repoFolderPath })).promise();


        const estatu = await this.estatusService.findOne(2);

        const sourcecode = await this.sourcecodeService.create({
          nom_codigo_fuente: this.encryptionService.encrypt(repoName),
          nom_directorio: this.encryptionService.encrypt(this.downloadPath)
        });

        const application = new Application();
        application.nom_aplicacion = this.encryptionService.encrypt(repoName);
        application.applicationstatus = estatu;
        application.sourcecode = sourcecode;
        application.user = user;

        await this.applicationRepository.save(application);
        application.nom_aplicacion = this.encryptionService.decrypt(application.nom_aplicacion);

        return application;

      } catch (error) {
        this.handleDBExceptions( error );
      }

      
    }

  private getRepoName(url: string): string {
    const regex = /([^\/]+)\.git$/;
    const match = url.match(regex);
    if (match) {
      return match[1];
    }
    return '';
  }

  private getUserName(url: string): string {
    const regex = /github\.com\/([^\/]+)\/[^\/]+\.git$/;
    const match = url.match(regex);
    if (match) {
      return match[1];
    }
    return '';
  }

  async createFile(file, user: User){

    try {

      const nameApplication = file.originalname.split('.')[0];
      const estatu = await this.estatusService.findOne(2);

      const sourcecode = await this.sourcecodeService.create({
         nom_codigo_fuente: this.encryptionService.encrypt(file.filename),
         nom_directorio: this.encryptionService.encrypt(file.destination)
      });

      

      // Descomprimir el archivo ZIP usando unzipper
      await createReadStream(file.path)
        .pipe(unzipper.Extract({ path: file.destination }))
        .promise();

      const pathDelete = join( file.destination, file.filename );
      unlinkSync(pathDelete);

      const application = new Application();
      application.nom_aplicacion = this.encryptionService.encrypt(nameApplication);
      application.applicationstatus = estatu;
      application.sourcecode = sourcecode;
      application.user = user;

      // Guarda la nueva aplicación en la base de datos
      await this.applicationRepository.save(application);

      application.nom_aplicacion = this.encryptionService.decrypt(application.nom_aplicacion);

      return application;

   } catch (error) {

      this.handleDBExceptions( error );
   }

  }

  async update(id: number, estatusId: number) {

    try {
      const application = await this.applicationRepository.findOne({
        where: { idu_aplicacion:id },
        relations: ['applicationstatus', 'user']
      });
      if( !application ) throw new NotFoundException(`Application with ${id} not found `);
  
  
      const estatu = await this.estatusService.findOne(estatusId);
  
      if (!estatu) {
        throw new Error(`Estatus with ID ${estatusId} not found`);
      }

      application.applicationstatus = estatu;
      await this.applicationRepository.save(application);

      application.nom_aplicacion = this.encryptionService.decrypt(application.nom_aplicacion);

      return application;

    } catch (error) {
      this.handleDBExceptions(error);
    }

  }

  async getStaticFileZip(id: number, response): Promise<void> {
    // Buscar la aplicación en el repositorio
    const application = await this.applicationRepository.findOne({
      where: { idu_aplicacion: id },
      relations: ['applicationstatus', 'user']
    });
  
    // Verificar si la aplicación existe
    if (!application) {
      throw new NotFoundException(`Application with ID ${id} not found`);
    }
  
    // Desencriptar el nombre de la aplicación para obtener el nombre de la carpeta
    const decryptedAppName = this.encryptionService.decrypt(application.nom_aplicacion);
    const directoryPath = join(this.downloadPath, decryptedAppName);
  
    // Verificar si el directorio existe
    if (!existsSync(directoryPath)) {
      throw new BadRequestException(`No directory found with name ${decryptedAppName}`);
    }
  
    // Configurar el encabezado de la respuesta para descarga de archivo ZIP
    response.setHeader('Content-Type', 'application/zip');
    response.setHeader('Content-Disposition', `attachment; filename="${decryptedAppName}.zip"`);
  
    // Crear un archivo ZIP y transmitirlo a la respuesta
    const archive = archiver('zip', { zlib: { level: 9 } });
  
    archive.on('error', (err) => {
      throw new BadRequestException(`Error while archiving: ${err.message}`);
    });
  
    // Pipe the archive data to the response
    archive.pipe(response);
  
    // Agregar el directorio al archivo ZIP
    archive.directory(directoryPath, false);
  
    // Finalizar el archivo ZIP
    await archive.finalize();
  }


  private handleDBExceptions( error:any ){
    if( error.code === '23505' )
      throw new BadRequestException(error.detail);

    if( error.response )
      throw new BadRequestException(error.message);

    this.logger.error(error);
    throw new InternalServerErrorException("Unexpected error, check server logs");
  }
}
