import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { MembersService } from './members.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('members')
@UseGuards(JwtAuthGuard)
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Post('register-face')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/registration',
        filename: (req, file, cb) => {
          const randomName = Array(16)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          cb(
            null,
            `reg-${Date.now()}-${randomName}${extname(file.originalname)}`,
          );
        },
      }),
    }),
  )
  async registerFace(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { name: string; role: string },
    @Request() req,
  ) {
    return this.membersService.registerFace(body, file, req.user.userId);
  }

  @Get()
  async findAll(@Request() req) {
    return this.membersService.findAll(req.user.userId);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.membersService.findOne(id, req.user.userId);
  }

  @Patch('update/:id')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/registration',
        filename: (req, file, cb) => {
          const randomName = Array(16)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          cb(
            null,
            `update-${Date.now()}-${randomName}${extname(file.originalname)}`,
          );
        },
      }),
    }),
  )
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name: string; role: string },
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    return this.membersService.update(id, body, file, req.user.userId);
  }

  @Delete('delete/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.membersService.remove(id, req.user.userId);
  }
}
