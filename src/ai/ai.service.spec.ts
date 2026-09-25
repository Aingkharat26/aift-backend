import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';

describe('AiService', () => {
  let aiService: AiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'GEMINI_API_KEY') return 'test-key';
              return null;
            }),
          },
        },
      ],
    }).compile();

    aiService = module.get<AiService>(AiService);
  });

  it('should be defined', () => {
    expect(aiService).toBeDefined();
  });

  describe('fallbackExtractExpense', () => {
    it('should extract single item correctly', () => {
      const result = (aiService as any).fallbackExtractExpense('ข้าวผัด 50 บาท');
      expect(result).toBeDefined();
      expect(result.amount).toBe(50);
      expect(result.item).toContain('ข้าวผัด');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].amount).toBe(50);
    });

    it('should extract multiple items correctly when multiple amounts exist', () => {
      const result = (aiService as any).fallbackExtractExpense('ข้าว 50 กาแฟ 40');
      expect(result).toBeDefined();
      expect(result.items.length).toBeGreaterThanOrEqual(2);
      expect(result.items[0].amount).toBe(50);
      expect(result.items[0].category).toBe('อาหาร');
      expect(result.items[1].amount).toBe(40);
      expect(result.items[1].category).toBe('เครื่องดื่ม');
    });

    it('should handle keyboard layout mistakes (Thai num keys)', () => {
      // ถจ = 50 in Thai keyboard numbers mapping
      const result = (aiService as any).fallbackExtractExpense('กะเพรา ถจ');
      expect(result).toBeDefined();
      expect(result.amount).toBe(50);
    });
  });

  describe('fallbackExtractIncome', () => {
    it('should extract income correctly', () => {
      const result = (aiService as any).fallbackExtractIncome('เงินเดือน 30000');
      expect(result).toBeDefined();
      expect(result.amount).toBe(30000);
      expect(result.source).toContain('เงินเดือน');
    });

    it('should default source to รายรับทั่วไป if only number given', () => {
      const result = (aiService as any).fallbackExtractIncome('500');
      expect(result).toBeDefined();
      expect(result.amount).toBe(500);
      expect(result.source).toBe('รายรับทั่วไป');
    });
  });
});
