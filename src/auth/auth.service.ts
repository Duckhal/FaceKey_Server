import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    private jwtService: JwtService,
  ) {}

  // Hàm đăng ký
  async register(registerDto: RegisterDto) {
    const { username, email, password } = registerDto;

    // Kiểm tra trùng email
    const existing = await this.usersRepo.findOne({ where: { email } });
    if (existing) {
      throw new BadRequestException('Email has already been registered');
    }

    // Mã hoá mật khẩu
    const hashed = await bcrypt.hash(password, 10);
    const user = this.usersRepo.create({
      username,
      email,
      password: hashed,
    });

    await this.usersRepo.save(user);
    return user;
  }

  // Hàm đăng nhập
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.usersRepo.findOne({ where: { email } });
    if (!user) return null;

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return null;

    // Tạo token JWT
    const payload = { sub: user.user_id, email: user.email };
    const token = await this.jwtService.signAsync(payload, { expiresIn: '7d' });

    return token;
  }
}
