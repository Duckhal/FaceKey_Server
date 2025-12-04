import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessLog } from './entities/accesslog.entity';
import * as fs from 'fs';
import { API_URL } from 'ip_config';

@Injectable()
export class AccesslogsService {
  private readonly baseUrl = `${API_URL}`;

  constructor(
    @InjectRepository(AccessLog)
    private readonly accessLogRepository: Repository<AccessLog>,
  ) {}

  async findAll(userId: number) {
    const logs = await this.accessLogRepository.find({
      where: {
        user: { user_id: userId },
      },
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

  async clearAll(userId: number) {
    try {
      const logs = await this.accessLogRepository.find({
        where: { user: { user_id: userId } },
      });

      logs.forEach((log) => {
        if (log.snapshot_url) {
          try {
            if (fs.existsSync(log.snapshot_url)) {
              fs.unlinkSync(log.snapshot_url);
              console.log(`File: ${log.snapshot_url} deleted successfully.`);
            }
          } catch (err) {
            console.error(
              `Failed to delete file ${log.snapshot_url}:`,
              err.message,
            );
          }
        }
      });

      await this.accessLogRepository
        .createQueryBuilder()
        .delete()
        .from(AccessLog)
        .where('user_id = :id', { id: userId })
        .execute();

      return { message: 'All your history and images have been deleted.' };
    } catch (error) {
      console.error('!!! CRITICAL ERROR WHEN DELETING LOGS !!!', error);
      throw new InternalServerErrorException('Error deleting logs');
    }
  }
}
