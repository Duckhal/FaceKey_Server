import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    try {
      const user = await this.authService.register(registerDto);
      return {
        message: 'User registered successfully',
        user: {
          id: user.user_id,
          username: user.username,
          email: user.email,
        },
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    try {
      const token = await this.authService.login(loginDto);
      return { accessToken: token };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
