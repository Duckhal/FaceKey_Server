import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: '',
      database: 'nest_db',
      autoLoadEntities: true,
      synchronize: true, // ⚠️ chỉ bật khi dev (tự tạo bảng)
    }),
    UsersModule,
  ],
})
export class AppModule {}
