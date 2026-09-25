import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { Budget } from '../budgets/entities/budget.entity';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

export const DEFAULT_CATEGORIES = [
  { name: 'อาหาร', icon: 'utensils', color: '#f59e0b' },
  { name: 'เครื่องดื่ม', icon: 'coffee', color: '#06b6d4' },
  { name: 'เดินทาง', icon: 'car', color: '#0ea5e9' },
  { name: 'ช้อปปิ้ง', icon: 'shopping-bag', color: '#ec4899' },
  { name: 'บันเทิง', icon: 'film', color: '#f97316' },
  { name: 'สุขภาพ', icon: 'heart-pulse', color: '#10b981' },
  { name: 'บิล', icon: 'receipt', color: '#ef4444' },
  { name: 'สัตว์เลี้ยง', icon: 'paw', color: '#fb7185' },
  { name: 'อื่นๆ', icon: 'folder', color: '#64748b' },
];

@Injectable()
export class CategoriesService implements OnModuleInit {
  constructor(
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
    @InjectRepository(Expense)
    private expensesRepository: Repository<Expense>,
    @InjectRepository(Budget)
    private budgetsRepository: Repository<Budget>,
  ) {}

  async onModuleInit() {
    await this.ensureDefaultCategories();
  }

  async ensureDefaultCategories() {
    try {
      const existingDefaults = await this.categoriesRepository.find({
        where: { isDefault: true },
      });

      const existingNames = new Set(existingDefaults.map((c) => c.name));

      for (const def of DEFAULT_CATEGORIES) {
        if (!existingNames.has(def.name)) {
          const cat = new Category();
          cat.name = def.name;
          cat.icon = def.icon;
          cat.color = def.color;
          cat.isDefault = true;
          cat.userId = null as any;
          await this.categoriesRepository.save(cat);
        }
      }
    } catch (e) {
      // Table may not be ready during initial module init on fresh db
    }
  }

  async findAll(userId: number): Promise<any[]> {
    await this.ensureDefaultCategories();

    const categories = await this.categoriesRepository
      .createQueryBuilder('category')
      .where('(category.isDefault = :isDefault AND (category.userId IS NULL OR category.userId = 0))', { isDefault: true })
      .orWhere('(category.isDefault = false AND category.userId = :userId)', { userId })
      .orderBy('category.isDefault', 'DESC')
      .addOrderBy('category.id', 'ASC')
      .getMany();

    // Query stats per category for this user
    const stats = await this.expensesRepository
      .createQueryBuilder('expense')
      .select('expense.category', 'category')
      .addSelect('COUNT(expense.id)', 'count')
      .addSelect('SUM(expense.amount)', 'total')
      .where('expense.userId = :userId', { userId })
      .groupBy('expense.category')
      .getRawMany();

    const statsMap = new Map<string, { count: number; total: number }>();
    stats.forEach((s) => {
      statsMap.set(s.category, {
        count: parseInt(s.count, 10) || 0,
        total: parseFloat(s.total) || 0,
      });
    });

    return categories.map((cat) => {
      const stat = statsMap.get(cat.name) || { count: 0, total: 0 };
      return {
        ...cat,
        expenseCount: stat.count,
        totalExpense: stat.total,
      };
    });
  }

  async create(dto: CreateCategoryDto, userId: number): Promise<Category> {
    const name = dto.name?.trim();
    if (!name) {
      throw new BadRequestException('ชื่อหมวดหมู่ต้องไม่เป็นค่าว่าง');
    }

    // Check duplicate
    const existing = await this.categoriesRepository
      .createQueryBuilder('category')
      .where('LOWER(category.name) = LOWER(:name)', { name })
      .andWhere('(category.isDefault = true OR category.userId = :userId)', {
        userId,
      })
      .getOne();

    if (existing) {
      throw new BadRequestException(`หมวดหมู่ "${name}" มีอยู่ในระบบแล้ว`);
    }

    const category = new Category();
    category.name = name;
    category.icon = dto.icon?.trim() || 'folder';
    category.color = dto.color?.trim() || '#64748b';
    category.isDefault = false;
    category.userId = userId;

    return this.categoriesRepository.save(category);
  }

  async update(
    id: number,
    dto: UpdateCategoryDto,
    userId: number,
  ): Promise<Category> {
    const category = await this.categoriesRepository.findOne({ where: { id } });

    if (!category) {
      throw new NotFoundException('ไม่พบหมวดหมู่ที่ต้องการแก้ไข');
    }

    if (category.isDefault || category.userId !== userId) {
      throw new BadRequestException('ไม่สามารถแก้ไขหมวดหมู่เริ่มต้นของระบบได้');
    }

    const oldName = category.name;
    const newName = dto.name?.trim() || oldName;

    if (newName !== oldName) {
      const duplicate = await this.categoriesRepository
        .createQueryBuilder('c')
        .where('LOWER(c.name) = LOWER(:name)', { name: newName })
        .andWhere('c.id != :id', { id })
        .andWhere('(c.isDefault = true OR c.userId = :userId)', { userId })
        .getOne();

      if (duplicate) {
        throw new BadRequestException(`ชื่อหมวดหมู่ "${newName}" ซ้ำกับที่มีอยู่แล้ว`);
      }

      // Update existing expenses using oldName to newName
      await this.expensesRepository
        .createQueryBuilder()
        .update(Expense)
        .set({ category: newName })
        .where('userId = :userId AND category = :oldName', { userId, oldName })
        .execute();

      // Update existing budgets using oldName to newName
      await this.budgetsRepository
        .createQueryBuilder()
        .update(Budget)
        .set({ category: newName })
        .where('userId = :userId AND category = :oldName', { userId, oldName })
        .execute();
    }

    category.name = newName;
    if (dto.icon) category.icon = dto.icon.trim();
    if (dto.color) category.color = dto.color.trim();

    return this.categoriesRepository.save(category);
  }

  async delete(id: number, userId: number): Promise<{ success: boolean; message: string }> {
    const category = await this.categoriesRepository.findOne({ where: { id } });

    if (!category) {
      throw new NotFoundException('ไม่พบหมวดหมู่ที่ต้องการลบ');
    }

    if (category.isDefault || category.userId !== userId) {
      throw new BadRequestException('ไม่สามารถลบหมวดหมู่เริ่มต้นของระบบได้');
    }

    // Check if any expenses are using this category
    const expenseCount = await this.expensesRepository.count({
      where: { userId, category: category.name },
    });

    if (expenseCount > 0) {
      throw new BadRequestException(
        `ไม่สามารถลบหมวดหมู่ "${category.name}" ได้ เนื่องจากยังมี ${expenseCount} รายการใช้จ่ายที่ใช้หมวดหมู่นี้อยู่`,
      );
    }

    // Also remove budget if exists
    await this.budgetsRepository.delete({
      userId,
      category: category.name,
    });

    await this.categoriesRepository.delete(id);

    return {
      success: true,
      message: `ลบหมวดหมู่ "${category.name}" เรียบร้อยแล้ว`,
    };
  }
}
