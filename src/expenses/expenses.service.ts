import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from './entities/expense.entity';
import { AiService } from '../ai/ai.service';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private expensesRepository: Repository<Expense>,
    private aiService: AiService,
  ) {}

  async processChat(text: string): Promise<Expense> {
    const aiResult = await this.aiService.extractExpenseData(text);
    
    const expense = new Expense();
    expense.item = aiResult.item;
    expense.amount = aiResult.amount;
    expense.category = aiResult.category;
    
    return this.expensesRepository.save(expense);
  }

  async getDailyExpenses(dateStr?: string): Promise<Expense[]> {
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    return this.expensesRepository.createQueryBuilder('expense')
      .where('expense.date >= :startOfDay', { startOfDay })
      .andWhere('expense.date <= :endOfDay', { endOfDay })
      .orderBy('expense.date', 'DESC')
      .getMany();
  }

  async getMonthlySummary(year?: number, month?: number): Promise<{ category: string; total: number }[]> {
    const now = new Date();
    const targetYear = year ?? now.getFullYear();
    const targetMonth = month !== undefined ? month - 1 : now.getMonth(); // month is 1-indexed from query, convert to 0-indexed
    
    const startOfMonth = new Date(targetYear, targetMonth, 1);
    const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);
    
    const result = await this.expensesRepository.createQueryBuilder('expense')
      .select('expense.category', 'category')
      .addSelect('SUM(expense.amount)', 'total')
      .where('expense.date >= :startOfMonth', { startOfMonth })
      .andWhere('expense.date <= :endOfMonth', { endOfMonth })
      .groupBy('expense.category')
      .getRawMany();
      
    return result.map(r => ({ category: r.category, total: parseFloat(r.total) }));
  }

  async deleteExpense(id: number): Promise<void> {
    await this.expensesRepository.delete(id);
  }
}
