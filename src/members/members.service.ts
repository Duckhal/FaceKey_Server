import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Member } from './entities/member.entity';
import { FaceData } from '../facedata/entities/facedata.entity';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as fs from 'fs';

import FormData = require('form-data');

@Injectable()
export class MembersService {

  private readonly baseUrl = 'http://192.168.145.16:3000';
  
  constructor(
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>,
    @InjectRepository(FaceData)
    private readonly faceDataRepository: Repository<FaceData>,
    private readonly httpService: HttpService,
  ) {}

  /**
   * API 1: Đăng ký khuôn mặt
   */
  async registerFace(
    body: { name: string; role: string },
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new NotFoundException('Không có file ảnh nào được upload.');
    }

    // 1. Gọi AI Service
    const formData = new FormData();
    formData.append('file', fs.createReadStream(file.path));
    const url = 'http://127.0.0.1:5000/recognize';
    let embedding: number[];

    try {
      const { data } = await firstValueFrom(
        this.httpService.post(url, formData, {
          headers: { ...formData.getHeaders() },
        }),
      );
      if (!data.success) {
        throw new Error(data.detail || 'AI Service không thể xử lý ảnh.');
      }
      embedding = data.embedding;
    } catch (error) {
      fs.unlinkSync(file.path);
      throw new Error(`Lỗi từ AI Service: ${error.message}`);
    }

    // 2. Lưu vào Database
    const newMember = this.memberRepository.create({
      name: body.name,
      role: body.role || 'Member',
    });
    const savedMember = await this.memberRepository.save(newMember);

    // 3. Tạo FaceData
    const newFaceData = this.faceDataRepository.create({
      member: savedMember,
      face_encoding: Buffer.from(JSON.stringify(embedding)), 
      image_url: file.path,
    });
    await this.faceDataRepository.save(newFaceData);

    return savedMember;
  }

  /**
   * API: Lấy tất cả member (kèm avatar)
   */
async findAll(): Promise<any[]> {
    const members = await this.memberRepository.find({
      relations: {
        faceData: true,
      },
    });

    return members.map((member) => {
      const imageUrl =
        member.faceData && member.faceData.length > 0
          ? member.faceData[0].image_url
          : null;

      return {
        id: member.member_id.toString(),
        name: member.name,
        role: member.role,
        avatar: imageUrl
          ? `${this.baseUrl}/${imageUrl.replace(/\\/g, '/')}`
          : null,
      };
    });
  }

  /**
   * API: Lấy 1 member (kèm avatar)
   */
async findOne(id: number): Promise<any> {
    const member = await this.memberRepository.findOne({
      where: { member_id: id },
      relations: {
        faceData: true,
      },
    });

    if (!member) {
      throw new NotFoundException(`Không tìm thấy thành viên với ID #${id}`);
    }

    const imageUrl =
      member.faceData && member.faceData.length > 0
        ? member.faceData[0].image_url
        : null;

    return {
      id: member.member_id.toString(),
      name: member.name,
      role: member.role,
      avatar: imageUrl
        ? `${this.baseUrl}/${imageUrl.replace(/\\/g, '/')}`
        : null,
    };
  }

  /**
   * API: Cập nhật member (Hàm 3 tham số)
   */
  async update(
    id: number,
    body: { name: string; role: string },
    file: Express.Multer.File,
  ): Promise<Member> {
    const member = await this.memberRepository.findOne({
      where: { member_id: id },
    });
    if (!member) {
      throw new NotFoundException(`Không tìm thấy thành viên với ID #${id}`);
    }

    // 1. Cập nhật thông tin (name/role)
    member.name = body.name;
    member.role = body.role;
    await this.memberRepository.save(member);

    // 2. Nếu có file ảnh mới, cập nhật FaceData
    if (file) {
      console.log('Đang cập nhật ảnh đại diện...');

      const formData = new FormData();
      formData.append('file', fs.createReadStream(file.path));
      const url = 'http://127.0.0.1:5000/recognize';
      let embedding: number[];
      try {
        const { data } = await firstValueFrom(
          this.httpService.post(url, formData, {
            headers: { ...formData.getHeaders() },
          }),
        );
        if (!data.success) throw new Error(data.detail);
        embedding = data.embedding;
      } catch (error) {
        fs.unlinkSync(file.path);
        throw new Error(`Lỗi từ AI Service: ${error.message}`);
      }

      await this.faceDataRepository.delete({ member: { member_id: id } });

      const newFaceData = this.faceDataRepository.create({
        member: member,
        face_encoding: Buffer.from(JSON.stringify(embedding)),
        image_url: file.path,
      });
      await this.faceDataRepository.save(newFaceData);
    }

    return member;
  }

  /**
   * API: Xóa member
   */
  async remove(id: number): Promise<void> {
    
    // 1. Tìm member VÀ các faceData liên quan
    const member = await this.memberRepository.findOne({
      where: { member_id: id },
      relations: {
        faceData: true,
      },
    });

    // 2. Kiểm tra
    if (!member) {
      throw new NotFoundException(`Không tìm thấy thành viên với ID #${id}`);
    }

    // 3. Lấy đường dẫn ảnh
    const imageUrl =
      member.faceData && member.faceData.length > 0
        ? member.faceData[0].image_url
        : null;

    // 4. Xóa member khỏi DB
    // (Dùng .remove(entity) sẽ kích hoạt cascade delete cho FaceData, AccessLog)
    await this.memberRepository.remove(member);

    // 5. Xóa file ảnh trên server
    if (imageUrl) {
      try {
        fs.unlinkSync(imageUrl);
        console.log(`Đã xóa file ảnh: ${imageUrl}`);
      } catch (err) {
        console.error(`Lỗi khi xóa file ${imageUrl}:`, err);
      }
    }
  }
}