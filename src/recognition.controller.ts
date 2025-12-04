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
import { FaceData } from './facedata/entities/facedata.entity';
import { AccessLog } from './accesslogs/entities/accesslog.entity';
import { AI_SERVICE_URL } from 'ip_config';

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
      // 1. Save snapshot image (to 'uploads/logs' directory)
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
  async handleRecognition(@UploadedFile() file: Express.Multer.File) {
    console.log('Snapshot image received:', file.filename);

    let aiResponse;
    try {
      aiResponse = await this.realAiServiceCall(file.path);
    } catch (error) {
      console.error('Error calling AI Service:', error.message);
      return { message: 'Error calling AI Service' };
    }

    if (!aiResponse.success) {
      console.log('AI Service reported error:', aiResponse.detail);
      try {
        fs.unlinkSync(file.path);
        console.log(`Automatically deleted junk image: ${file.filename}`);
      } catch (err) {
        console.log(`Error deleting file ${file.path}:`, err);
      }
      this.appGateway.notifyUi({ message: 'Face not recognized' });
      return { message: 'Face not recognized' };
    }

    const newEmbedding: number[] = aiResponse.embedding;

    // 3. Process AI results
    // Get all registered faces from DB
    const allRegisteredFaces = await this.faceDataRepository.find({
      relations: ['member'], // Also get 'member' info
    });

    // Find the best matching face
    const bestMatch = this.findBestMatch(newEmbedding, allRegisteredFaces);

    let logEntry;

    const RECOGNITION_THRESHOLD = 0.6;

    if (bestMatch && bestMatch.distance < RECOGNITION_THRESHOLD) {
      // If recognized successfully
      const matchedMember = bestMatch.face.member;
      console.log(`Recognized: ${matchedMember.name}`);

      logEntry = this.accessLogRepository.create({
        member: matchedMember,
        member_name_snapshot: matchedMember.name,
        action: 'granted',
        snapshot_url: file.path,
      });

      // 4a. Send command to open the door
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

    // 5. Save to AccessLogs
    const savedLog = await this.accessLogRepository.save(logEntry);

    // 4b. Send log result to React UI
    this.appGateway.notifyUi(savedLog);

    // 6. Respond to HTTP request from ESP32-CAM
    return {
      message: 'Recognition process complete',
      result: savedLog,
    };
  }

  /**
   * Call Python AI Service
   */
  private async realAiServiceCall(filePath: string): Promise<any> {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));

    // Call Python server (running on port 5000)
    const url = `${AI_SERVICE_URL}/recognize`;

    try {
      const { data } = await firstValueFrom(
        this.httpService.post(url, formData, {
          headers: {
            ...formData.getHeaders(),
          },
        }),
      );
      return data; // Return { success: true, embedding: [...] }
    } catch (error) {
      if (error.response) {
        return { success: false, detail: error.response.data.detail };
      }
      throw new Error(`Cannot connect to AI Service: ${error.message}`);
    }
  }

  /**
   * Calculate L2 (Euclidean) distance between 2 embedding vectors
   */
  private calculateL2Distance(emb1: number[], emb2: number[]): number {
    let sum = 0;
    for (let i = 0; i < emb1.length; i++) {
      sum += Math.pow(emb1[i] - emb2[i], 2);
    }
    return Math.sqrt(sum);
  }

  /**
   * Compare new embedding with all embeddings in DB
   */
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
}
