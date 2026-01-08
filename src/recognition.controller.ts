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
import { Device } from './devices/entities/device.entity';
import { Door } from './doors/entities/door.entity';
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
    @InjectRepository(Door)
    private doorRepository: Repository<Door>,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('open')
  async remoteOpen(@Body('door_id') doorId: number, @Request() req) {
    const userId = req.user.userId;

    const door = await this.doorRepository.findOne({
      where: { id: doorId, user: { user_id: userId } },
      relations: ['lockDevice'],
    });

    if (!door || !door.lockDevice) {
      throw new ForbiddenException('Door not found or Lock device missing.');
    }

    const commandStr = `${door.gpio_pin}:OPEN_DOOR`;

    this.appGateway.sendCommandToDevice(userId, {
      command: commandStr,
      from_device: door.lockDevice.device_uid,
      timestamp: new Date().toISOString(),
    });

    const logEntry = this.accessLogRepository.create({
      member_name_snapshot: 'Remote App Control',
      action: AccessAction.GRANTED_REMOTE,
      snapshot_url: undefined,
      user: { user_id: userId },
    });
    await this.accessLogRepository.save(logEntry);

    return { message: 'Open command sent', success: true };
  }

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
    @Headers('x-device-uid') cameraUid: string,
  ) {
    if (!cameraUid) {
      this.cleanupFile(file.path);
      return { message: 'Missing x-device-uid header' };
    }

    console.log(`Snapshot received from Camera Device: ${cameraUid}`);

    const linkedDoor = await this.doorRepository.findOne({
      where: {
        cameraDevice: { device_uid: cameraUid },
      },
      relations: ['user', 'lockDevice'],
    });

    if (!linkedDoor) {
      this.cleanupFile(file.path);
      console.log(`Camera ${cameraUid} is not linked to any Door in DB.`);
      return { message: 'Camera not configured for any door' };
    }

    const owner = linkedDoor.user;

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
    const RECOGNITION_THRESHOLD = 0.6;
    let logEntry;

    if (bestMatch && bestMatch.distance < RECOGNITION_THRESHOLD) {
      const matchedMember = bestMatch.face.member;

      console.log(
        `Face Matched via CAM ${cameraUid} => Opening Door ID ${linkedDoor.id} (Lock: ${linkedDoor.lockDevice?.device_uid})`,
      );

      if (linkedDoor.lockDevice) {
        const commandStr = `${linkedDoor.gpio_pin}:OPEN_DOOR`;

        this.appGateway.sendCommandToDevice(owner.user_id, {
          command: commandStr,
          from_device: linkedDoor.lockDevice.device_uid,
          timestamp: new Date().toISOString(),
        });
      }

      logEntry = this.accessLogRepository.create({
        member: matchedMember,
        member_name_snapshot: matchedMember.name,
        action: AccessAction.GRANTED,
        snapshot_url: file.path,
        user: owner,
      });
    } else {
      console.log('Unrecognized face');
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
