import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Inject,
  Headers, // <--- 1. Import Headers
  UnauthorizedException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AppGateway } from './app.gateway';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FaceData } from './facedata/entities/facedata.entity';
import { AccessLog } from './accesslogs/entities/accesslog.entity';
import { Device } from './devices/entities/device.entity'; // <--- 2. Import Device Entity
import { AI_SERVICE_URL } from 'ip_config';

import FormData = require('form-data');
import * as fs from 'fs';
import { time } from 'console';

@Controller('device')
export class RecognitionController {
  constructor(
    private readonly appGateway: AppGateway,
    private readonly httpService: HttpService,
    @InjectRepository(FaceData)
    private faceDataRepository: Repository<FaceData>,
    @InjectRepository(AccessLog)
    private accessLogRepository: Repository<AccessLog>,
    @InjectRepository(Device) // <--- 3. Inject Device Repository
    private deviceRepository: Repository<Device>,
  ) {}

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
    @Headers('x-device-uid') deviceUid: string, // <--- 4. Nhận MAC Address từ ESP32
  ) {
    console.log(`Snapshot received from Device: ${deviceUid}`);

    // === BƯỚC 1: XÁC THỰC THIẾT BỊ ===
    if (!deviceUid) {
      this.cleanupFile(file.path);
      return { message: 'Missing x-device-uid header' };
    }

    const device = await this.deviceRepository.findOne({
      where: { device_uid: deviceUid },
      relations: ['user'], // Lấy thông tin chủ sở hữu (User)
    });

    if (!device) {
      this.cleanupFile(file.path);
      console.log(`Device ${deviceUid} not registered.`);
      return { message: 'Device not registered' };
    }

    const owner = device.user; // Đây là Admin/Chủ nhà của thiết bị này

    // === BƯỚC 2: GỌI AI SERVICE ===
    let aiResponse;
    try {
      aiResponse = await this.realAiServiceCall(file.path);
    } catch (error) {
      console.error('Error calling AI Service:', error.message);
      return { message: 'Error calling AI Service' };
    }

    if (!aiResponse.success) {
      this.cleanupFile(file.path); // Xóa ảnh rác nếu AI không nhận diện được mặt người

      // Gửi thông báo cho RIÊNG User này
      this.appGateway.notifyUi(owner.user_id, { message: 'Face not detected' });
      return { message: 'Face not detected' };
    }

    const newEmbedding: number[] = aiResponse.embedding;

    // === BƯỚC 3: LỌC DỮ LIỆU KHUÔN MẶT (MULTI-TENANT) ===
    // Chỉ lấy khuôn mặt của Member thuộc User này
    const registeredFaces = await this.faceDataRepository.find({
      where: {
        member: { user: { user_id: owner.user_id } },
      },
      relations: ['member'],
    });

    // === BƯỚC 4: SO SÁNH ===
    const bestMatch = this.findBestMatch(newEmbedding, registeredFaces);

    let logEntry;
    const RECOGNITION_THRESHOLD = 0.5; // (Lưu ý: 0.6 đôi khi hơi lỏng, 0.5 chặt hơn)

    if (bestMatch && bestMatch.distance < RECOGNITION_THRESHOLD) {
      // --> NHẬN DIỆN THÀNH CÔNG
      const matchedMember = bestMatch.face.member;
      console.log(`Recognized: ${matchedMember.name} (Owner: ${owner.email})`);

      logEntry = this.accessLogRepository.create({
        member: matchedMember,
        member_name_snapshot: matchedMember.name,
        action: 'granted',
        snapshot_url: file.path,
        user: owner, // <--- Gắn Log vào User
        // device: device, // <--- (Optional) Gắn Log vào Device nếu Entity AccessLog đã có quan hệ này
      });

      // Mở cửa (Gửi lệnh kèm userId để Gateway biết gửi cho ai/thiết bị nào)
      this.appGateway.sendCommandToDevice(owner.user_id, {
        command: 'OPEN_DOOR',
        from_device: device.device_uid,
        timestamp: new Date().toISOString(),
      });
    } else {
      // --> KHÔNG NHẬN RA (NGƯỜI LẠ)
      console.log('Unrecognized face');
      logEntry = this.accessLogRepository.create({
        member_name_snapshot: 'Unknown',
        action: 'denied_unrecognized',
        snapshot_url: file.path,
        user: owner, // <--- Vẫn phải gắn Log vào User để họ biết có người lạ
        // device: device,
      });
    }

    // === BƯỚC 5: LƯU VÀ THÔNG BÁO ===
    const savedLog = await this.accessLogRepository.save(logEntry);

    // Chỉ gửi thông báo UI cho User sở hữu thiết bị này
    this.appGateway.notifyUi(owner.user_id, savedLog);

    return {
      message: 'Recognition process complete',
      result: savedLog,
    };
  }

  // --- CÁC HÀM PHỤ TRỢ ---

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
      if (error.response) {
        return { success: false, detail: error.response.data.detail };
      }
      throw new Error(`Cannot connect to AI Service: ${error.message}`);
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
    console.log(`Best match distance: ${minDistance}`);
    return bestMatch;
  }

  // Hàm dọn dẹp file ảnh rác
  private cleanupFile(path: string) {
    try {
      if (fs.existsSync(path)) fs.unlinkSync(path);
    } catch (e) {
      console.error('Cleanup error', e);
    }
  }
}
