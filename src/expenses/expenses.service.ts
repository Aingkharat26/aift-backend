import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from './entities/expense.entity';
import { AiSummaryCache } from './entities/ai-summary-cache.entity';
import { AiService } from '../ai/ai.service';
import { IncomeService } from '../income/income.service';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private expensesRepository: Repository<Expense>,
    @InjectRepository(AiSummaryCache)
    private aiSummaryCacheRepository: Repository<AiSummaryCache>,
    private aiService: AiService,
    private incomeService: IncomeService,
  ) {}

  async processChat(text: string, userId: number): Promise<any> {
    const aiResult = await this.aiService.extractExpenseData(text);

    // If multiple items are detected, return them for user preview/confirmation
    if (aiResult.items && aiResult.items.length > 1) {
      return {
        isBatch: true,
        count: aiResult.items.length,
        items: aiResult.items,
      };
    }

    const itemToSave = (aiResult.items && aiResult.items[0]) || {
      item: aiResult.item,
      amount: aiResult.amount,
      category: aiResult.category,
    };

    const expense = new Expense();
    expense.item = itemToSave.item;
    expense.amount = itemToSave.amount;
    expense.category = itemToSave.category;
    expense.userId = userId;

    const saved = await this.expensesRepository.save(expense);
    return {
      isBatch: false,
      count: 1,
      ...saved,
    };
  }

  async saveBatch(
    items: Array<{ item: string; amount: number; category?: string }>,
    userId: number,
  ): Promise<Expense[]> {
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('Items array is required');
    }

    const expensesToSave: Expense[] = items.map((i) => {
      const expense = new Expense();
      expense.item = (i.item || 'รายจ่าย').trim();
      expense.amount = Number(i.amount) || 0;
      expense.category = (i.category || 'อื่นๆ').trim();
      expense.userId = userId;
      return expense;
    });

    return this.expensesRepository.save(expensesToSave);
  }

  async getDailyExpenses(
    userId: number,
    dateStr?: string,
  ): Promise<Expense[]> {
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

    return this.expensesRepository
      .createQueryBuilder('expense')
      .where('expense.userId = :userId', { userId })
      .andWhere('expense.date >= :startOfDay', { startOfDay })
      .andWhere('expense.date <= :endOfDay', { endOfDay })
      .orderBy('expense.date', 'DESC')
      .getMany();
  }

  async getMonthlySummary(
    userId: number,
    year?: number,
    month?: number,
  ): Promise<{ category: string; total: number }[]> {
    const now = new Date();
    const targetYear = year ?? now.getFullYear();
    const targetMonth = month !== undefined ? month - 1 : now.getMonth(); // month is 1-indexed from query, convert to 0-indexed

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

    const result = await this.expensesRepository
      .createQueryBuilder('expense')
      .select('expense.category', 'category')
      .addSelect('SUM(expense.amount)', 'total')
      .where('expense.userId = :userId', { userId })
      .andWhere('expense.date >= :startOfMonth', { startOfMonth })
      .andWhere('expense.date <= :endOfMonth', { endOfMonth })
      .groupBy('expense.category')
      .getRawMany();

    return result.map((r) => ({
      category: r.category,
      total: parseFloat(r.total),
    }));
  }

  async processReceiptImage(
    base64: string,
    mimeType: string,
    userId: number,
  ): Promise<Expense> {
    const aiResult = await this.aiService.extractExpenseFromReceipt(
      base64,
      mimeType,
    );

    const expense = new Expense();
    expense.item = aiResult.item;
    expense.amount = aiResult.amount;
    expense.category = aiResult.category;
    expense.userId = userId;

    return this.expensesRepository.save(expense);
  }

  async getAiMonthlySummary(
    userId: number,
    year?: number,
    month?: number,
    force = false,
  ) {
    const now = new Date();
    const targetYear = year ?? now.getFullYear();
    const targetMonth = month !== undefined ? month : now.getMonth() + 1; // 1-indexed

    // คำนวณเดือนก่อนหน้า
    const prevDate = new Date(targetYear, targetMonth - 1, 1);
    prevDate.setMonth(prevDate.getMonth() - 1);
    const prevYear = prevDate.getFullYear();
    const prevMonth = prevDate.getMonth() + 1;

    const currentExpenses = await this.getMonthlySummary(
      userId,
      targetYear,
      targetMonth,
    );
    const currentIncome = await this.incomeService.getMonthlyIncome(
      userId,
      targetYear,
      targetMonth,
    );
    const previousExpenses = await this.getMonthlySummary(
      userId,
      prevYear,
      prevMonth,
    );
    const previousIncome = await this.incomeService.getMonthlyIncome(
      userId,
      prevYear,
      prevMonth,
    );

    const currentTotal = currentExpenses.reduce((sum, e) => sum + e.total, 0);
    const previousTotal = previousExpenses.reduce((sum, e) => sum + e.total, 0);

    const monthLabel = new Date(
      targetYear,
      targetMonth - 1,
      1,
    ).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
    const prevLabel = new Date(prevYear, prevMonth - 1, 1).toLocaleDateString(
      'th-TH',
      { month: 'long', year: 'numeric' },
    );

    // ถ้ายังไม่มีข้อมูลเดือนนี้ เลยไม่ต้องเรียก AI ประหยัด quota
    // และลบ cache เดิมทิ้ง (กรณีเคยมีข้อมูลแล้วลบหมด)
    if (currentTotal === 0 && currentIncome === 0) {
      await this.aiSummaryCacheRepository.delete({
        year: targetYear,
        month: targetMonth,
        userId,
      });
      return {
        summary: `เดือน${monthLabel} ยังไม่มีรายการ บันทึกรับรายจ่ายก่อน แล้ว AI จะวิเคราะห์ให้ครับ`,
        generated: false,
        hasData: false,
      };
    }

    // ไม่บังคับคำนวณใหม่ → อ่านจาก cache ก่อน (ประหยัด quota ตอน F5/เปลี่ยนเดือน)
    if (!force) {
      const cached = await this.aiSummaryCacheRepository.findOne({
        where: { year: targetYear, month: targetMonth, userId },
      });
      if (cached) {
        return {
          summary: cached.summary,
          generated: cached.generated,
          hasData: true,
        };
      }
    }

    let summary: string;
    let generated: boolean;
    try {
      summary = await this.aiService.generateMonthlyInsight({
        monthLabel,
        prevLabel,
        currentExpenses,
        currentExpenseTotal: currentTotal,
        currentIncomeTotal: currentIncome,
        previousExpenses,
        previousExpenseTotal: previousTotal,
        previousIncomeTotal: previousIncome,
      });
      generated = true;
    } catch (e) {
      // Fallback: สรุปสำเร็จรูปจากตัวเลขเองถ้า AI ล่ม/โควตาเต็ม
      const fmt = (n: number) =>
        Math.round(n)
          .toString()
          .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      const top = [...currentExpenses].sort((a, b) => b.total - a.total)[0];
      const balance = currentIncome - currentTotal;

      let text = `เดือน${monthLabel} ใช้จ่ายทั้งหมด ${fmt(currentTotal)} บาท รายรับ ${fmt(currentIncome)} บาท คงเหลือ ${fmt(balance)} บาท`;
      if (top) {
        text += ` หมวดที่จ่ายหนักสุดคือ ${top.category} (${fmt(top.total)} บาท)`;
      }
      if (previousTotal > 0) {
        const diff = ((currentTotal - previousTotal) / previousTotal) * 100;
        text +=
          diff >= 0
            ? ` เพิ่มขึ้น ${Math.abs(diff).toFixed(1)}% จากเดือนก่อนหน้า`
            : ` ลดลง ${Math.abs(diff).toFixed(1)}% จากเดือนก่อนหน้า`;
      }
      summary = text;
      generated = false;
    }

    // เก็บ cache ไว้ให้ F5 ครั้งถัดไปอ่านโดยไม่ต้องเรียก AI
    const existing = await this.aiSummaryCacheRepository.findOne({
      where: { year: targetYear, month: targetMonth, userId },
    });
    if (existing) {
      existing.summary = summary;
      existing.generated = generated;
      await this.aiSummaryCacheRepository.save(existing);
    } else {
      await this.aiSummaryCacheRepository.save(
        this.aiSummaryCacheRepository.create({
          year: targetYear,
          month: targetMonth,
          summary,
          generated,
          userId,
        }),
      );
    }

    return { summary, generated, hasData: true };
  }

  async updateExpense(
    id: number,
    userId: number,
    data: { item?: string; amount?: number; category?: string },
  ): Promise<Expense> {
    const expense = await this.expensesRepository.findOne({
      where: { id, userId },
    });
    if (!expense) {
      throw new NotFoundException(`Expense with id ${id} not found`);
    }

    if (data.item !== undefined) expense.item = data.item;
    if (data.amount !== undefined) expense.amount = data.amount;
    if (data.category !== undefined) expense.category = data.category;

    return this.expensesRepository.save(expense);
  }

  async deleteExpense(id: number, userId: number): Promise<void> {
    const result = await this.expensesRepository.delete({ id, userId });
    if (!result.affected) {
      throw new NotFoundException(`Expense with id ${id} not found`);
    }
  }
}
