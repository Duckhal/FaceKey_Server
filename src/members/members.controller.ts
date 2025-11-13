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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer'; 
import { extname } from 'path';
import { MembersService } from './members.service';

@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  /**
   * API 1: Đăng ký member mới
   * POST /members/register-face
   */
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
          cb(null, `reg-${Date.now()}-${randomName}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  async registerFace(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { name: string; role: string }, // Nhận name/role từ FormData
  ) {
    return this.membersService.registerFace(body, file);
  }

  /**
   * API: Lấy tất cả member
   * GET /members
   */
  @Get()
  async findAll() {
    return this.membersService.findAll();
  }

  /**
   * API: Lấy 1 member
   * GET /members/:id
   */
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.membersService.findOne(id);
  }

  /**
   * API: Cập nhật member
   * PATCH /members/update/:id)
   */
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
          cb(null, `update-${Date.now()}-${randomName}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name: string; role: string }, // Nhận name/role
    @UploadedFile() file: Express.Multer.File, // Nhận file (có thể undefined)
  ) {
    return this.membersService.update(id, body, file);
  }

  /**
   * API: Xóa member
   * DELETE /members/delete/:id
   */
  @Delete('delete/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.membersService.remove(id);
  }
}