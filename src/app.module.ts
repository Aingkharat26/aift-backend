import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ExpensesModule } from './expenses/expenses.module';
import { AiModule } from './ai/ai.module';
import { Expense } from './expenses/entities/expense.entity';
import { AiSummaryCache } from './expenses/entities/ai-summary-cache.entity';
import { Income } from './income/entities/income.entity';
import { IncomeModule } from './income/income.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // ใช้ SQLite สำหรับ development (ไม่ต้องตั้งค่า postgres/password)
    // หากจะ deploy กับ PostgreSQL ให้เปลี่ยนกลับเป็น type: 'postgres' พร้อม env DB_*
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: 'data/aift.sqlite',
      entities: [Expense, Income, AiSummaryCache],
      synchronize: true, // Auto-create tables (for development only)
    }),
    ExpensesModule,
    IncomeModule,
    AiModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
