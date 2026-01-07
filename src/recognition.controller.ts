import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  UploadedFile,
  Headers,
  UseGuards,
  Request,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import FormData = require('form-data');

import { AppGateway } from './app.gateway';
import { FaceData } from './facedata/entities/facedata.entity';
import {
  AccessLog,
  AccessAction,
} from './accesslogs/entities/accesslog.entity';
import { Device, DeviceType } from './devices/entities/device.entity';
import { AI_SERVICE_URL } from 'ip_config';
import { JwtAuthGuard } from './auth/jwt-auth.guard';

@Controller('recognition')
export class RecognitionController {
  constructor(
    private readonly appGateway: AppGateway,
    private readonly httpService: HttpService,
    @InjectRepository(FaceData)
    private faceDataRepository: Repository<FaceData>,
    @InjectRepository(AccessLog)
    private accessLogRepository: Repository<AccessLog>,
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
  ) {}

  // Mở cửa từ xa qua app
  @UseGuards(JwtAuthGuard)
  @Post('open')
  async remoteOpen(@Body('device_uid') deviceUid: string, @Request() req) {
    const userId = req.user.userId;

    const device = await this.deviceRepository.findOne({
      where: {
        device_uid: deviceUid,
        user: { user_id: userId },
      },
    });

    if (!device) {
      throw new ForbiddenException('Device not found or access denied.');
    }

    // KIỂM TRA device_type - CHỈ CHO PHÉP LOCK
    if (device.device_type !== DeviceType.LOCK) {
      throw new BadRequestException(
        'This device is not a LOCK type. Cannot open door.',
      );
    }

    this.appGateway.sendCommandToDevice(userId, {
      command: 'OPEN_DOOR',
      from_device: deviceUid,
      timestamp: new Date().toISOString(),
    });

    // 2. SỬA DÙNG ENUM
    const logEntry = this.accessLogRepository.create({
      member_name_snapshot: 'Remote App Control',
      action: AccessAction.GRANTED_REMOTE,
      snapshot_url: undefined,
      user: { user_id: userId },
    });
    await this.accessLogRepository.save(logEntry);

    return { message: 'Open command sent', success: true };
  }

  // Nhận diện khuôn mặt
  @Post('recognize')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/logs',
        filename: (req, file, cb) => {
          const randomName = Array(16)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          cb(
            null,
            `snap-${Date.now()}-${randomName}${extname(file.originalname)}`,
          );
        },
      }),
    }),
  )
  async handleRecognition(
    @UploadedFile() file: Express.Multer.File,
    @Headers('x-device-uid') deviceUid: string,
  ) {
    if (!deviceUid) {
      this.cleanupFile(file.path);
      return { message: 'Missing x-device-uid header' };
    }

    const device = await this.deviceRepository.findOne({
      where: { device_uid: deviceUid },
      relations: ['user'],
    });

    if (!device) {
      this.cleanupFile(file.path);
      return { message: 'Device not registered' };
    }

    const owner = device.user;

    let aiResponse;
    try {
      aiResponse = await this.realAiServiceCall(file.path);
    } catch (error) {
      console.error('AI Service Error:', error.message);
      return { message: 'Error calling AI Service' };
    }

    if (!aiResponse.success) {
      this.cleanupFile(file.path);
      this.appGateway.notifyUi(owner.user_id, { message: 'Face not detected' });
      return { message: 'Face not detected' };
    }

    const registeredFaces = await this.faceDataRepository.find({
      where: { member: { user: { user_id: owner.user_id } } },
      relations: ['member'],
    });

    const bestMatch = this.findBestMatch(aiResponse.embedding, registeredFaces);
    const RECOGNITION_THRESHOLD = 0.8;
    let logEntry;

    if (bestMatch && bestMatch.distance < RECOGNITION_THRESHOLD) {
      const matchedMember = bestMatch.face.member;

      const lockDevice = await this.deviceRepository.findOne({
        where: {
          user: { user_id: owner.user_id },
          device_type: DeviceType.LOCK,
        },
      });

      if (lockDevice) {
        this.appGateway.sendCommandToDevice(owner.user_id, {
          command: 'OPEN_DOOR',
          from_device: lockDevice.device_uid,
          timestamp: new Date().toISOString(),
        });
      } else {
        console.warn(`No LOCK device found for user ${owner.user_id}`);
      }

      logEntry = this.accessLogRepository.create({
        member: matchedMember,
        member_name_snapshot: matchedMember.name,
        action: AccessAction.GRANTED,
        snapshot_url: file.path,
        user: owner,
      });
    } else {
      logEntry = this.accessLogRepository.create({
        member_name_snapshot: 'Unknown',
        action: AccessAction.DENIED,
        snapshot_url: file.path,
        user: owner,
      });
    }

    const savedLog = await this.accessLogRepository.save(logEntry);
    this.appGateway.notifyUi(owner.user_id, savedLog);

    return { message: 'Process complete', result: savedLog };
  }

  // Helper Functions
  private async realAiServiceCall(filePath: string): Promise<any> {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));
    const url = `${AI_SERVICE_URL}/recognize`;

    try {
      const { data } = await firstValueFrom(
        this.httpService.post(url, formData, {
          headers: { ...formData.getHeaders() },
        }),
      );
      return data;
    } catch (error) {
      if (error.response)
        return { success: false, detail: error.response.data.detail };
      throw new Error(`AI Service Connect Error: ${error.message}`);
    }
  }

  private calculateL2Distance(emb1: number[], emb2: number[]): number {
    let sum = 0;
    for (let i = 0; i < emb1.length; i++) {
      sum += Math.pow(emb1[i] - emb2[i], 2);
    }
    return Math.sqrt(sum);
  }

  private findBestMatch(
    newEmbedding: number[],
    dbFaces: FaceData[],
  ): { face: FaceData; distance: number } | null {
    let bestMatch: { face: FaceData; distance: number } | null = null;
    let minDistance = Infinity;

    for (const face of dbFaces) {
      const dbEmbedding = JSON.parse(face.face_encoding.toString());
      const distance = this.calculateL2Distance(newEmbedding, dbEmbedding);

      if (distance < minDistance) {
        minDistance = distance;
        bestMatch = { face, distance };
      }
    }
    return bestMatch;
  }

  private cleanupFile(path: string) {
    try {
      if (fs.existsSync(path)) fs.unlinkSync(path);
    } catch (e) {
      console.error('Cleanup error', e);
    }
  }
}
