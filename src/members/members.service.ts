import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Member } from './entities/member.entity';
import { FaceData } from '../facedata/entities/facedata.entity';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as fs from 'fs';
import { API_URL, AI_SERVICE_URL } from 'ip_config';

import FormData = require('form-data');

@Injectable()
export class MembersService {
  private readonly baseUrl = `${API_URL}`;

  constructor(
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>,
    @InjectRepository(FaceData)
    private readonly faceDataRepository: Repository<FaceData>,
    private readonly httpService: HttpService,
  ) {}

  async registerFace(
    body: { name: string; role: string },
    file: Express.Multer.File,
    userId: number,
  ) {
    if (!file) {
      throw new NotFoundException('No image file uploaded.');
    }

    // 1. Call AI Service
    const formData = new FormData();
    formData.append('file', fs.createReadStream(file.path));
    const url = `${AI_SERVICE_URL}/recognize`;
    let embedding: number[];

    try {
      const { data } = await firstValueFrom(
        this.httpService.post(url, formData, {
          headers: { ...formData.getHeaders() },
        }),
      );
      if (!data.success) {
        throw new Error(data.detail || 'AI Service cannot process the image.');
      }
      embedding = data.embedding;
    } catch (error) {
      fs.unlinkSync(file.path);
      throw new Error(`Error from AI Service: ${error.message}`);
    }

    const newMember = this.memberRepository.create({
      name: body.name,
      role: body.role || 'Member',
      user: { user_id: userId },
    });
    const savedMember = await this.memberRepository.save(newMember);

    // 2. Create FaceData
    const newFaceData = this.faceDataRepository.create({
      member: savedMember,
      face_encoding: Buffer.from(JSON.stringify(embedding)),
      image_url: file.path,
    });
    await this.faceDataRepository.save(newFaceData);

    return savedMember;
  }

  async findAll(userId: number): Promise<any[]> {
    const members = await this.memberRepository.find({
      where: { user: { user_id: userId } },
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

  async findOne(id: number, userId: number): Promise<any> {
    const member = await this.memberRepository.findOne({
      where: {
        member_id: id,
        user: { user_id: userId },
      },
      relations: {
        faceData: true,
      },
    });

    if (!member) {
      throw new NotFoundException(`Member with ID #${id} not found`);
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

  async update(
    id: number,
    body: { name: string; role: string },
    file: Express.Multer.File,
    userId: number,
  ): Promise<Member> {
    const member = await this.memberRepository.findOne({
      where: { member_id: id, user: { user_id: userId } },
    });

    if (!member) {
      throw new NotFoundException(`Member with ID #${id} not found`);
    }

    member.name = body.name;
    member.role = body.role;
    await this.memberRepository.save(member);

    if (file) {
      console.log('Updating avatar image...');

      const formData = new FormData();
      formData.append('file', fs.createReadStream(file.path));
      const url = `${AI_SERVICE_URL}/recognize`;
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
        throw new Error(`Error from AI Service: ${error.message}`);
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

  async remove(id: number, userId: number): Promise<void> {
    const member = await this.memberRepository.findOne({
      where: { member_id: id, user: { user_id: userId } },
      relations: {
        faceData: true,
      },
    });

    if (!member) {
      throw new NotFoundException(`Member with ID #${id} not found`);
    }

    const imageUrl =
      member.faceData && member.faceData.length > 0
        ? member.faceData[0].image_url
        : null;

    await this.memberRepository.remove(member);

    if (imageUrl) {
      try {
        if (fs.existsSync(imageUrl)) {
          fs.unlinkSync(imageUrl);
          console.log(`Deleted image file: ${imageUrl}`);
        }
      } catch (err) {
        console.error(`Error deleting file ${imageUrl}:`, err);
      }
    }
  }
}
