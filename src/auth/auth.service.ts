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
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    private jwtService: JwtService,
    private readonly mailerService: MailerService,
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

  async forgotPassword(email: string) {
    const user = await this.usersRepo.findOne({ where: { email } });
    if (!user) {
      throw new BadRequestException('Email is not registered');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 5 * 60 * 1000);

    user.reset_otp = otp;
    user.reset_otp_expiry = expiry;
    await this.usersRepo.save(user);

    await this.mailerService.sendMail({
      to: email,
      subject: 'Reset Your Password - OTP Code',
      html: `<b>Your verification code is: ${otp}</b>. The code is valid for 5 minutes.`,
    });

    return { message: 'OTP has been sent to your email' };
  }

  // Verify OTP code
  async verifyOtp(email: string, otp: string) {
    const user = await this.usersRepo.findOne({ where: { email } });

    if (!user) throw new BadRequestException('User does not exist');

    if (user.reset_otp !== otp) {
      throw new BadRequestException('OTP code is incorrect');
    }

    if (user.reset_otp_expiry && new Date() > user.reset_otp_expiry) {
      throw new BadRequestException('OTP code has expired');
    }

    return { message: 'OTP is valid' };
  }

  async resetPassword(email: string, otp: string, newPassword: string) {
    await this.verifyOtp(email, otp);
    const user = await this.usersRepo.findOne({ where: { email } });

    if (!user) {
      throw new BadRequestException('User does not exist');
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;

    user.reset_otp = null;
    user.reset_otp_expiry = null;

    await this.usersRepo.save(user);

    return { message: 'Password has been successfully changed' };
  }
}
