import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { Expense } from './entities/expense.entity';
import { AiSummaryCache } from './entities/ai-summary-cache.entity';
import { AiModule } from '../ai/ai.module';
import { IncomeModule } from '../income/income.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Expense, AiSummaryCache]),
    AiModule,
    IncomeModule,
  ],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
