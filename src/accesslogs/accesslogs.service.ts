import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessLog } from './entities/accesslog.entity';
import * as fs from 'fs';

@Injectable()
export class AccesslogsService {
  private readonly baseUrl = 'http://192.168.7.16:3000';

  constructor(
    @InjectRepository(AccessLog)
    private readonly accessLogRepository: Repository<AccessLog>,
  ) {}

  async findAll() {
    const logs = await this.accessLogRepository.find({
      order: { timestamp: 'DESC' },
      relations: ['member'],
    });

    return logs.map((log) => ({
      ...log,
      snapshot_url: log.snapshot_url
        ? `${this.baseUrl}/${log.snapshot_url.replace(/\\/g, '/')}`
        : null,
    }));
  }

  async clearAll() {
    try {
      const logs = await this.accessLogRepository.find();

      logs.forEach((log) => {
        if (log.snapshot_url) {
          try {
            if (fs.existsSync(log.snapshot_url)) {
              fs.unlinkSync(log.snapshot_url);
              console.log(`Đã xóa file: ${log.snapshot_url}`);
            }
          } catch (err) {
            console.error(
              `Không xóa được file ${log.snapshot_url}:`,
              err.message,
            );
          }
        }
      });

      await this.accessLogRepository.createQueryBuilder().delete().execute();

      return { message: 'Đã xóa toàn bộ lịch sử và ảnh.' };
    } catch (error) {
      console.error('!!! LỖI NGHIÊM TRỌNG KHI XÓA LOGS !!!', error);
      throw new InternalServerErrorException('Lỗi khi xóa logs');
    }
  }
}
