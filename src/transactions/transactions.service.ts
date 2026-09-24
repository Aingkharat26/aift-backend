import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from '../expenses/entities/expense.entity';
import { Income } from '../income/entities/income.entity';

export interface TransactionItem {
  id: number;
  type: 'expense' | 'income';
  title: string;
  amount: number;
  category: string;
  date: Date;
}

export interface TransactionFilterDto {
  keyword?: string;
  type?: 'all' | 'expense' | 'income';
  category?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface TransactionResponse {
  items: TransactionItem[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: {
    totalIncome: number;
    totalExpense: number;
    netBalance: number;
  };
  categories: string[];
}

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(Income)
    private readonly incomeRepository: Repository<Income>,
  ) {}

  async getTransactions(
    userId: number,
    filter: TransactionFilterDto,
  ): Promise<TransactionResponse> {
    const page = Math.max(1, Number(filter.page) || 1);
    const limit = filter.limit !== undefined ? Math.max(0, Number(filter.limit)) : 20;
    const type = filter.type || 'all';
    const keyword = filter.keyword?.trim()?.toLowerCase();
    const category = filter.category?.trim();

    let startDate: Date | undefined;
    if (filter.startDate) {
      const [y, m, d] = filter.startDate.split('-').map(Number);
      startDate = new Date(y, m - 1, d, 0, 0, 0, 0);
    }

    let endDate: Date | undefined;
    if (filter.endDate) {
      const [y, m, d] = filter.endDate.split('-').map(Number);
      endDate = new Date(y, m - 1, d, 23, 59, 59, 999);
    }

    let expenses: Expense[] = [];
    let incomes: Income[] = [];

    // Query Expenses if type is 'all' or 'expense'
    if (type === 'all' || type === 'expense') {
      const qb = this.expenseRepository
        .createQueryBuilder('expense')
        .where('expense.userId = :userId', { userId });

      if (keyword) {
        qb.andWhere(
          '(LOWER(expense.item) LIKE :kw OR LOWER(expense.category) LIKE :kw)',
          { kw: `%${keyword}%` },
        );
      }

      if (category && category !== 'all') {
        qb.andWhere('expense.category = :category', { category });
      }

      if (startDate) {
        qb.andWhere('expense.date >= :startDate', { startDate });
      }

      if (endDate) {
        qb.andWhere('expense.date <= :endDate', { endDate });
      }

      qb.orderBy('expense.date', 'DESC');
      expenses = await qb.getMany();
    }

    // Query Incomes if type is 'all' or 'income'
    // Note: If a specific expense category is chosen (other than 'all' or 'Income'), income is excluded
    const canIncludeIncome =
      (type === 'all' || type === 'income') &&
      (!category || category === 'all' || category === 'Income' || category === 'รายรับ');

    if (canIncludeIncome) {
      const qb = this.incomeRepository
        .createQueryBuilder('income')
        .where('income.userId = :userId', { userId });

      if (keyword) {
        qb.andWhere('LOWER(income.source) LIKE :kw', { kw: `%${keyword}%` });
      }

      if (startDate) {
        qb.andWhere('income.date >= :startDate', { startDate });
      }

      if (endDate) {
        qb.andWhere('income.date <= :endDate', { endDate });
      }

      qb.orderBy('income.date', 'DESC');
      incomes = await qb.getMany();
    }

    // Map Expenses
    const mappedExpenses: TransactionItem[] = expenses.map((e) => ({
      id: e.id,
      type: 'expense',
      title: e.item,
      amount: Number(e.amount),
      category: e.category,
      date: new Date(e.date),
    }));

    // Map Incomes
    const mappedIncomes: TransactionItem[] = incomes.map((i) => ({
      id: i.id,
      type: 'income',
      title: i.source,
      amount: Number(i.amount),
      category: 'Income',
      date: new Date(i.date),
    }));

    // Combine & Sort by date descending
    const allItems = [...mappedExpenses, ...mappedIncomes].sort(
      (a, b) => b.date.getTime() - a.date.getTime(),
    );

    // Calculate Summary on the filtered set
    let totalIncome = 0;
    let totalExpense = 0;
    for (const item of allItems) {
      if (item.type === 'income') {
        totalIncome += item.amount;
      } else {
        totalExpense += item.amount;
      }
    }
    const netBalance = totalIncome - totalExpense;
    const totalCount = allItems.length;

    // Distinct categories for filter
    const rawCategories = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('DISTINCT(expense.category)', 'category')
      .where('expense.userId = :userId', { userId })
      .getRawMany();

    const categories = rawCategories
      .map((r) => r.category)
      .filter((c): c is string => Boolean(c))
      .sort();

    // Pagination
    let paginatedItems: TransactionItem[];
    let totalPages = 1;

    if (limit > 0) {
      totalPages = Math.ceil(totalCount / limit) || 1;
      const startIndex = (page - 1) * limit;
      paginatedItems = allItems.slice(startIndex, startIndex + limit);
    } else {
      paginatedItems = allItems;
    }

    return {
      items: paginatedItems,
      totalCount,
      page,
      limit,
      totalPages,
      summary: {
        totalIncome,
        totalExpense,
        netBalance,
      },
      categories,
    };
  }

  generateCsv(items: TransactionItem[]): string {
    const headers = ['ลำดับ', 'วันที่', 'เวลา', 'ประเภท', 'หมวดหมู่', 'รายการ', 'จำนวนเงิน (บาท)'];
    const rows = items.map((item, index) => {
      const d = new Date(item.date);
      const dateStr = d.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const timeStr = d.toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const typeStr = item.type === 'income' ? 'รายรับ' : 'รายจ่าย';
      const safeTitle = `"${item.title.replace(/"/g, '""')}"`;
      const safeCategory = `"${item.category.replace(/"/g, '""')}"`;
      const amountStr = item.type === 'income' ? `+${item.amount}` : `-${item.amount}`;

      return [index + 1, dateStr, timeStr, typeStr, safeCategory, safeTitle, amountStr].join(',');
    });

    // UTF-8 BOM prefix (\uFEFF) for Excel Thai encoding support
    return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  }
}
