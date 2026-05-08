import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Income } from './entities/income.entity';
import { AiService } from '../ai/ai.service';

@Injectable()
export class IncomeService {
  constructor(
    @InjectRepository(Income)
    private incomeRepository: Repository<Income>,
    private aiService: AiService,
  ) {}

  async processChat(text: string): Promise<Income> {
    const aiResult = await this.aiService.extractIncomeData(text);

    const income = new Income();
    income.source = aiResult.source;
    income.amount = aiResult.amount;

    return this.incomeRepository.save(income);
  }

  async create(data: { source: string; amount: number }): Promise<Income> {
    const income = new Income();
    income.source = data.source;
    income.amount = data.amount;
    return this.incomeRepository.save(income);
  }

  async getMonthlyIncome(year?: number, month?: number): Promise<number> {
    const now = new Date();
    const targetYear = year ?? now.getFullYear();
    const targetMonth = month !== undefined ? month - 1 : now.getMonth();

    const startOfMonth = new Date(targetYear, targetMonth, 1);
    const endOfMonth = new Date(
      targetYear,
      targetMonth + 1,
      0,
      23,
      59,
      59,
      999,
    );

    const result = await this.incomeRepository
      .createQueryBuilder('income')
      .select('SUM(income.amount)', 'total')
      .where('income.date >= :startOfMonth', { startOfMonth })
      .andWhere('income.date <= :endOfMonth', { endOfMonth })
      .getRawOne();

    return parseFloat(result.total || 0);
  }

  async getDailyIncome(dateStr?: string): Promise<Income[]> {
    let targetDate: Date;
    if (dateStr) {
      // Parse YYYY-MM-DD as local time to avoid UTC shift
      const [y, m, d] = dateStr.split('-').map(Number);
      targetDate = new Date(y, m - 1, d);
    } else {
      targetDate = new Date();
    }

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    return this.incomeRepository
      .createQueryBuilder('income')
      .where('income.date >= :startOfDay', { startOfDay })
      .andWhere('income.date <= :endOfDay', { endOfDay })
      .orderBy('income.date', 'DESC')
      .getMany();
  }

  async delete(id: number): Promise<void> {
    await this.incomeRepository.delete(id);
  }
}
