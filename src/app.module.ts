import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { MailerModule } from '@nestjs-modules/mailer';
import { UsersModule } from './users/users.module';
import { MembersModule } from './members/members.module';
import { FacedataModule } from './facedata/facedata.module';
import { AccesslogsModule } from './accesslogs/accesslogs.module';
import { AuthModule } from './auth/auth.module';
import { JwtStrategy } from './auth/jwt.strategy';
import { User } from './users/entities/user.entity';
import { Member } from './members/entities/member.entity';
import { FaceData } from './facedata/entities/facedata.entity';
import { AccessLog } from './accesslogs/entities/accesslog.entity';
import { AppGateway } from './app.gateway';
import { RecognitionController } from './recognition.controller';
import { HttpModule } from '@nestjs/axios';
import { ServeStaticModule } from '@nestjs/serve-static';
import { DevicesModule } from './devices/devices.module';
import { Device } from './devices/entities/device.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MailerModule.forRoot({
      transport: {
        host: process.env.MAIL_HOST,
        port: Number(process.env.MAIL_PORT),
        secure: false,
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS,
        },
      },
      defaults: {
        from: '"No Reply" <no-reply@example.com>',
      },
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [User, Member, FaceData, AccessLog, Device],
      synchronize: true,
    }),

    UsersModule,
    MembersModule,
    FacedataModule,
    AccesslogsModule,
    AuthModule,

    HttpModule,
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    TypeOrmModule.forFeature([FaceData, AccessLog, Device]),
    DevicesModule,
  ],

  controllers: [
    RecognitionController, // Controller received from ESP32-CAM
  ],
  providers: [AppGateway, JwtStrategy],
})
export class AppModule {}
