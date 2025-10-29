import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]), // <-- thêm dòng này
    JwtModule.register({
      secret: 'yourSecretKey', // thay bằng secret thật (hoặc .env)
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService], // có thể export nếu module khác dùng AuthService
})
export class AuthModule {}
