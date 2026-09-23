import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ExpensesModule } from './expenses/expenses.module';
import { AiModule } from './ai/ai.module';
import { Expense } from './expenses/entities/expense.entity';
import { AiSummaryCache } from './expenses/entities/ai-summary-cache.entity';
import { Income } from './income/entities/income.entity';
import { IncomeModule } from './income/income.module';
import { Budget } from './budgets/entities/budget.entity';
import { BudgetsModule } from './budgets/budgets.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbType = configService.get<string>('DB_TYPE', 'sqlite');
        if (dbType === 'postgres') {
          return {
            type: 'postgres',
            host: configService.get<string>('DB_HOST', 'localhost'),
            port: Number(configService.get('DB_PORT', 5432)),
            username: configService.get<string>('DB_USER', 'postgres'),
            password: configService.get<string>('DB_PASS', 'postgres'),
            database: configService.get<string>('DB_NAME', 'aift'),
            entities: [Expense, Income, AiSummaryCache, Budget],
            synchronize: true,
          };
        }
        return {
          type: 'better-sqlite3',
          database: configService.get<string>('DB_DATABASE', 'data/aift.sqlite'),
          entities: [Expense, Income, AiSummaryCache, Budget],
          synchronize: true,
        };
      },
    }),
    ExpensesModule,
    IncomeModule,
    AiModule,
    BudgetsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
