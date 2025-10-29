import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { MembersModule } from './members/members.module';
import { FacedataModule } from './facedata/facedata.module';
import { AccesslogsModule } from './accesslogs/accesslogs.module';
import { AuthModule } from './auth/auth.module';
import { User } from './users/entities/user.entity';
import { Member } from './members/entities/member.entity';
import { FaceData } from './facedata/entities/facedata.entity';
import { AccessLog } from './accesslogs/entities/accesslog.entity';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [User, Member, FaceData, AccessLog],
      synchronize: true, 
    }),
    UsersModule,
    MembersModule,
    FacedataModule,
    AccesslogsModule,
    AuthModule,
  ],
})
export class AppModule {}
