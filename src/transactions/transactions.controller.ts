import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  Header,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import {
  TransactionsService,
  TransactionFilterDto,
} from './transactions.service';

@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  async getTransactions(
    @CurrentUser() user: User,
    @Query('keyword') keyword?: string,
    @Query('type') type?: 'all' | 'expense' | 'income',
    @Query('category') category?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const filter: TransactionFilterDto = {
      keyword,
      type,
      category,
      startDate,
      endDate,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    };

    const data = await this.transactionsService.getTransactions(user.id, filter);
    return { success: true, data };
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(
    @CurrentUser() user: User,
    @Res() res: Response,
    @Query('keyword') keyword?: string,
    @Query('type') type?: 'all' | 'expense' | 'income',
    @Query('category') category?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // limit 0 means fetch all matching records for export
    const filter: TransactionFilterDto = {
      keyword,
      type,
      category,
      startDate,
      endDate,
      page: 1,
      limit: 0,
    };

    const result = await this.transactionsService.getTransactions(user.id, filter);
    const csvData = this.transactionsService.generateCsv(result.items);

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `aift-transactions-${timestamp}.csv`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvData);
  }
}
