import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
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

  async register(registerDto: RegisterDto) {
    const { username, email, password } = registerDto;

    const existing = await this.usersRepo.findOne({ where: { email } });
    if (existing) {
      throw new BadRequestException('Email has already been registered');
    }
    const hashed = await bcrypt.hash(password, 10);

    const user = this.usersRepo.create({
      username,
      email,
      password: hashed,
    });

    await this.usersRepo.save(user);

    const { password: _, ...result } = user;
    return result;
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const user = await this.usersRepo.findOne({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('Email is not registered');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Incorrect password');
    }
    const payload = { sub: user.user_id, email: user.email };
    const token = await this.jwtService.signAsync(payload, { expiresIn: '7d' });

    return {
      access_token: token,
      user: {
        id: user.user_id,
        email: user.email,
        username: user.username,
      },
    };
  }
}
