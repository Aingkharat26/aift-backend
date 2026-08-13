import { Controller, Post, Get, Body, Query, Delete, Patch, Param } from '@nestjs/common';
import { IncomeService } from './income.service';

@Controller('income')
export class IncomeController {
  constructor(private readonly incomeService: IncomeService) {}

  @Post('chat')
  async processChat(@Body('text') text: string) {
    const result = await this.incomeService.processChat(text);
    return { success: true, data: result };
  }

  @Post()
  async create(@Body() data: { source: string; amount: number }) {
    const result = await this.incomeService.create(data);
    return { success: true, data: result };
  }

  @Get('summary')
  async getMonthlySummary(
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const y = year ? parseInt(year) : undefined;
    const m = month ? parseInt(month) : undefined;
    const total = await this.incomeService.getMonthlyIncome(y, m);
    return { success: true, data: { total } };
  }

  @Get('daily')
  async getDaily(@Query('date') date?: string) {
    const data = await this.incomeService.getDailyIncome(date);
    return { success: true, data };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() data: { source?: string; amount?: number },
  ) {
    const result = await this.incomeService.update(parseInt(id), data);
    return { success: true, data: result };
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.incomeService.delete(parseInt(id));
    return { success: true };
  }
}
