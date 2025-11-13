import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Inject,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AppGateway } from './app.gateway';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FaceData } from './facedata/entities/facedata.entity'
import { AccessLog } from './accesslogs/entities/accesslog.entity';

import FormData = require('form-data');
import * as fs from 'fs';

@Controller('api')
export class RecognitionController {
  
  constructor(
    private readonly appGateway: AppGateway,
    private readonly httpService: HttpService,
    @InjectRepository(FaceData)
    private faceDataRepository: Repository<FaceData>,
    @InjectRepository(AccessLog)
    private accessLogRepository: Repository<AccessLog>,
  ) {}

  @Post('recognize')
  @UseInterceptors(
    FileInterceptor('file', {
      // 1. Lưu ảnh snapshot lại (vào thư mục 'uploads/logs')
      storage: diskStorage({
        destination: './uploads/logs', // Thư mục lưu log ảnh
        filename: (req, file, cb) => {
          const randomName = Array(16)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          cb(null, `snap-${Date.now()}-${randomName}${extname(file.originalname)}`);
        },
      }),
    }),)
  async handleRecognition(@UploadedFile() file: Express.Multer.File) {
    
    console.log('Ảnh snapshot đã nhận:', file.filename);

    let aiResponse;
    try {
      aiResponse = await this.realAiServiceCall(file.path);
    } catch (error) {
      console.error('Lỗi khi gọi AI Service:', error.message);
      return { message: 'Lỗi khi gọi AI Service' };
    }
    
    if (!aiResponse.success) {
      console.log('AI Service báo lỗi:', aiResponse.detail);
      try {
        fs.unlinkSync(file.path);
        console.log(`Đã tự động xóa ảnh rác: ${file.filename}`);
      } catch (err) {
        console.log(`Lỗi khi xóa file ${file.path}:`, err);
      }
      this.appGateway.notifyUi({ message: 'Không nhận diện được khuôn mặt' });
      return { message: 'Không nhận diện được khuôn mặt' };
    }

    const newEmbedding: number[] = aiResponse.embedding;

    // 3. Xử lý kết quả từ AI
    // Lấy tất cả khuôn mặt đã đăng ký từ DB
    const allRegisteredFaces = await this.faceDataRepository.find({
      relations: ['member'], // Lấy luôn thông tin 'member'
    });

    // Tìm khuôn mặt khớp nhất
    const bestMatch = this.findBestMatch(newEmbedding, allRegisteredFaces);

    let logEntry;

    const RECOGNITION_THRESHOLD = 0.6; 

    if (bestMatch && bestMatch.distance < RECOGNITION_THRESHOLD) {
      // Nếu nhận diện thành công
      const matchedMember = bestMatch.face.member;
      console.log(`Recognized: ${matchedMember.name}`);

      logEntry = this.accessLogRepository.create({
        member: matchedMember,
        member_name_snapshot: matchedMember.name,
        action: 'granted',
        snapshot_url: file.path,
      });
      
      // 4a. Gửi lệnh mở cửa
      this.appGateway.sendCommandToDevice({ command: 'OPEN_DOOR' });

    } else {
      // Nếu không nhận ra
      console.log('Unrecognized face');
      logEntry = this.accessLogRepository.create({
        //member: null,
        member_name_snapshot: 'Unknown',
        action: 'denied_unrecognized',
        snapshot_url: file.path,
      });
    }
    
    // 5. Lưu vào AccessLogs
    const savedLog = await this.accessLogRepository.save(logEntry);

    // 4b. Gửi kết quả log cho React UI
    this.appGateway.notifyUi(savedLog);

    // 6. Trả lời HTTP về cho ESP32-CAM
    return {
      message: 'Recognition process complete',
      result: savedLog,
    };
  }

  /**
   * Gọi đến AI Service Python
   */
  private async realAiServiceCall(filePath: string): Promise<any> {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));

    // Gọi đến Python server (đang chạy ở port 5000)
    const url = 'http://127.0.0.1:5000/recognize';

    try {
      const { data } = await firstValueFrom(
        this.httpService.post(url, formData, {
          headers: {
            ...formData.getHeaders(),
          },
        }),
      );
      return data; // Trả về { success: true, embedding: [...] }

    } catch (error) {
      if (error.response) {
        // Lỗi từ server AI (ví dụ: 400 No face detected)
        return { success: false, detail: error.response.data.detail };
      }
      // Lỗi kết nối
      throw new Error(`Không thể kết nối đến AI Service: ${error.message}`);
    }
  }

  /**
   * Tính khoảng cách L2 (Euclidean) giữa 2 vector embedding
   */
  private calculateL2Distance(emb1: number[], emb2: number[]): number {
    let sum = 0;
    for (let i = 0; i < emb1.length; i++) {
      sum += Math.pow(emb1[i] - emb2[i], 2);
    }
    return Math.sqrt(sum);
  }

  /**
   * So sánh embedding mới với tất cả embedding trong DB
   */
  private findBestMatch(newEmbedding: number[], dbFaces: FaceData[]): { face: FaceData, distance: number } | null {
    let bestMatch: { face: FaceData, distance: number } | null = null;
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
}