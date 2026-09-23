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

  async getAll(userId: number): Promise<Budget[]> {
    return this.budgetsRepository.find({
      where: { userId },
      order: { category: 'ASC' },
    });
  }

  async upsert(
    category: string,
    limit: number,
    userId: number,
  ): Promise<Budget> {
    const existing = await this.budgetsRepository.findOne({
      where: { category, userId },
    });
    if (existing) {
      existing.limit = limit;
      return this.budgetsRepository.save(existing);
    }
    return this.budgetsRepository.save(
      this.budgetsRepository.create({ category, limit, userId }),
    );
  }

  async remove(id: number, userId: number): Promise<void> {
    const result = await this.budgetsRepository.delete({ id, userId });
    if (!result.affected) {
      throw new NotFoundException(`Budget with id ${id} not found`);
    }
  }

  /**
   * แนะนำงบประมาณรายหมวดจากพฤติกรรมจริง:
   * ใช้ค่าเฉลี่ยการใช้จ่ายย้อนหลัง 3 เดือนล่าสุด (รวมเดือนปัจจุบัน)
   * แล้วปัดขึ้นให้เป็นเลขกลม ๆ (หลัก 50)
   */
  async getRecommendations(userId: number) {
    const now = new Date();
    const months: { year: number; month: number }[] = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }

    // ยอดใช้จ่ายแยกรายเดือนของแต่ละหมวด
    const totalsByMonth: Record<string, Record<string, number>> = {};
    for (const { year, month } of months) {
      const summary = await this.expensesService.getMonthlySummary(
        userId,
        year,
        month,
      );
      totalsByMonth[`${year}-${month}`] = summary.reduce(
        (acc, s) => {
          acc[s.category] = s.total;
          return acc;
        },
        {} as Record<string, number>,
      );
    }

    const budgets = await this.getAll(userId);
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

    // เรียงตาม recommendedBudget จากมากไปน้อย
    recommendations.sort((a, b) => b.recommendedBudget - a.recommendedBudget);

    return recommendations;
  }

  /**
   * คำนวณสถานะงบประมาณรายหมวดของเดือนที่ระบุ:
   * คืนค่ารายการงบ พร้อมยอดใช้จริง, ยอดคงเหลือ, % ที่ใช้, และสถานะ (ok / warning / exceeded)
   */
  async getStatus(userId: number, year?: number, month?: number) {
    const now = new Date();
    const targetYear = year ?? now.getFullYear();
    const targetMonth = month !== undefined ? month : now.getMonth() + 1; // 1-indexed

    const budgets = await this.getAll(userId);
    const monthlySummary = await this.expensesService.getMonthlySummary(
      userId,
      targetYear,
      targetMonth,
    );
    const spentByCategory = new Map(
      monthlySummary.map((s) => [s.category, s.total]),
    );

    let totalBudget = 0;
    let totalSpent = 0;

    const items = budgets.map((b) => {
      const spent = spentByCategory.get(b.category) || 0;
      const limit = Number(b.limit);
      const remaining = limit - spent;
      const percent = limit > 0 ? (spent / limit) * 100 : 0;

      let status: 'ok' | 'warning' | 'exceeded' = 'ok';
      if (spent > limit) {
        status = 'exceeded';
      } else if (limit > 0 && spent / limit >= WARNING_THRESHOLD) {
        status = 'warning';
      }

      totalBudget += limit;
      totalSpent += spent;

      return {
        id: b.id,
        category: b.category,
        limit,
        spent: Math.round(spent * 100) / 100,
        remaining: Math.round(remaining * 100) / 100,
        percent: Math.round(percent * 10) / 10,
        status,
      };
    });

    const totalRemaining = totalBudget - totalSpent;
    const totalPercent =
      totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
    let overallStatus: 'ok' | 'warning' | 'exceeded' = 'ok';
    if (totalSpent > totalBudget && totalBudget > 0) {
      overallStatus = 'exceeded';
    } else if (totalBudget > 0 && totalSpent / totalBudget >= WARNING_THRESHOLD) {
      overallStatus = 'warning';
    }

    return {
      year: targetYear,
      month: targetMonth,
      items,
      totalBudget: Math.round(totalBudget * 100) / 100,
      totalSpent: Math.round(totalSpent * 100) / 100,
      totalRemaining: Math.round(totalRemaining * 100) / 100,
      totalPercent: Math.round(totalPercent * 10) / 10,
      overallStatus,
    };
  }
}
