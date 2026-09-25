import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { Category } from './entities/category.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { Budget } from '../budgets/entities/budget.entity';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let categoryRepo: any;
  let expenseRepo: any;
  let budgetRepo: any;

  beforeEach(async () => {
    categoryRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((cat) => Promise.resolve({ id: 10, ...cat })),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(),
    };

    expenseRepo = {
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    budgetRepo = {
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: getRepositoryToken(Category), useValue: categoryRepo },
        { provide: getRepositoryToken(Expense), useValue: expenseRepo },
        { provide: getRepositoryToken(Budget), useValue: budgetRepo },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw error if category name is empty', async () => {
      await expect(service.create({ name: '   ' }, 1)).rejects.toThrow(BadRequestException);
    });

    it('should throw error if category name already exists', async () => {
      categoryRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 1, name: 'อาหาร' }),
      });

      await expect(service.create({ name: 'อาหาร' }, 1)).rejects.toThrow(BadRequestException);
    });

    it('should create new custom category successfully', async () => {
      categoryRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });

      const res = await service.create({ name: 'กาชาปอง', icon: 'gamepad', color: '#f59e0b' }, 1);
      expect(res.name).toBe('กาชาปอง');
      expect(res.isDefault).toBe(false);
      expect(res.userId).toBe(1);
    });
  });

  describe('delete', () => {
    it('should throw NotFoundException if category does not exist', async () => {
      categoryRepo.findOne.mockResolvedValue(null);
      await expect(service.delete(999, 1)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if category is default system category', async () => {
      categoryRepo.findOne.mockResolvedValue({ id: 1, name: 'อาหาร', isDefault: true });
      await expect(service.delete(1, 1)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if expenses are using this category', async () => {
      categoryRepo.findOne.mockResolvedValue({ id: 10, name: 'เกม', isDefault: false, userId: 1 });
      expenseRepo.count.mockResolvedValue(3); // 3 expenses using it!

      await expect(service.delete(10, 1)).rejects.toThrow(BadRequestException);
      expect(expenseRepo.count).toHaveBeenCalledWith({ where: { userId: 1, category: 'เกม' } });
    });

    it('should delete category if no expenses are using it', async () => {
      categoryRepo.findOne.mockResolvedValue({ id: 10, name: 'เกม', isDefault: false, userId: 1 });
      expenseRepo.count.mockResolvedValue(0);

      const res = await service.delete(10, 1);
      expect(res.success).toBe(true);
      expect(categoryRepo.delete).toHaveBeenCalledWith(10);
    });
  });
});
