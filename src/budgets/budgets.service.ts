import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Budget } from './entities/budget.entity';
import { ExpensesService } from '../expenses/expenses.service';

const WARNING_THRESHOLD = 0.8; // 80% = ใกล้เกินงบ

@Injectable()
export class BudgetsService {
  constructor(
    @InjectRepository(Budget)
    private budgetsRepository: Repository<Budget>,
    private expensesService: ExpensesService,
  ) {}

  async getAll(): Promise<Budget[]> {
    return this.budgetsRepository.find({ order: { category: 'ASC' } });
  }

  async upsert(category: string, limit: number): Promise<Budget> {
    const existing = await this.budgetsRepository.findOne({
      where: { category },
    });
    if (existing) {
      existing.limit = limit;
      return this.budgetsRepository.save(existing);
    }
    return this.budgetsRepository.save(
      this.budgetsRepository.create({ category, limit }),
    );
  }

  async remove(id: number): Promise<void> {
    const result = await this.budgetsRepository.delete(id);
    if (!result.affected) {
      throw new NotFoundException(`Budget with id ${id} not found`);
    }
  }

  /**
   * แนะนำงบประมาณรายหมวดจากพฤติกรรมจริง:
   * ใช้ค่าเฉลี่ยการใช้จ่ายย้อนหลัง 3 เดือนล่าสุด (รวมเดือนปัจจุบัน)
   * แล้วปัดขึ้นให้เป็นเลขกลม ๆ (หลัก 50)
   */
  async getRecommendations() {
    const now = new Date();
    const months: { year: number; month: number }[] = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }

    // ยอดใช้จ่ายแยกรายเดือนของแต่ละหมวด
    const totalsByMonth: Record<string, Record<string, number>> = {};
    for (const { year, month } of months) {
      const summary = await this.expensesService.getMonthlySummary(year, month);
      totalsByMonth[`${year}-${month}`] = summary.reduce(
        (acc, s) => {
          acc[s.category] = s.total;
          return acc;
        },
        {} as Record<string, number>,
      );
    }

    const budgets = await this.getAll();
    const budgetByCategory = new Map(budgets.map((b) => [b.category, b.limit]));

    // รวมหมวดที่เคยใช้จ่ายใน 3 เดือนนี้
    const allCategories = new Set<string>();
    months.forEach(({ year, month }) => {
      Object.keys(totalsByMonth[`${year}-${month}`]).forEach((c) =>
        allCategories.add(c),
      );
    });

    const recommendations: {
      category: string;
      months: number;
      avgMonthly: number;
      recommendedBudget: number;
      currentBudget: number | null;
    }[] = [];

    for (const category of allCategories) {
      const values: number[] = [];
      for (const { year, month } of months) {
        const total = totalsByMonth[`${year}-${month}`][category];
        if (total && total > 0) values.push(total);
      }
      if (values.length === 0) continue;

      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const recommended = Math.max(50, Math.ceil(avg / 50) * 50);

      recommendations.push({
        category,
        months: values.length,
        avgMonthly: Math.round(avg * 100) / 100,
        recommendedBudget: recommended,
        currentBudget: budgetByCategory.get(category) ?? null,
      });
    }

    recommendations.sort((a, b) => b.avgMonthly - a.avgMonthly);
    return recommendations;
  }

  /**
   * สถานะการใช้จ่ายเดือนที่ระบุ เทียบกับงบที่ตั้งไว้
   * status: ok (< 80%) | warning (80-100%) | exceeded (> 100%)
   */
  async getStatus(year?: number, month?: number) {
    const now = new Date();
    const targetYear = year ?? now.getFullYear();
    const targetMonth = month !== undefined ? month : now.getMonth() + 1; // 1-indexed

    const [budgets, summary] = await Promise.all([
      this.getAll(),
      this.expensesService.getMonthlySummary(targetYear, targetMonth),
    ]);

    const spentByCategory = new Map(summary.map((s) => [s.category, s.total]));

    return budgets.map((b) => {
      const spent = spentByCategory.get(b.category) ?? 0;
      const percentUsed = b.limit > 0 ? (spent / b.limit) * 100 : 0;
      const status =
        percentUsed >= 100
          ? 'exceeded'
          : percentUsed >= WARNING_THRESHOLD * 100
            ? 'warning'
            : 'ok';

      return {
        id: b.id,
        category: b.category,
        limit: b.limit,
        spent: Math.round(spent * 100) / 100,
        remaining: Math.round(Math.max(0, b.limit - spent) * 100) / 100,
        percentUsed: Math.round(percentUsed * 10) / 10,
        status,
      };
    });
  }
}
