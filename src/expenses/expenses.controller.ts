import { Controller, Post, Body, Get, Delete, Param } from '@nestjs/common';
import { ExpensesService } from './expenses.service';

@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post('chat')
  async processChat(@Body('text') text: string) {
    if (!text) {
      return { success: false, message: 'Text is required' };
    }
    const result = await this.expensesService.processChat(text);
    return { success: true, data: result };
  }

  @Get('daily')
  async getDaily() {
    const data = await this.expensesService.getDailyExpenses();
    return { success: true, data };
  }

  @Get('summary')
  async getSummary() {
    const data = await this.expensesService.getMonthlySummary();
    return { success: true, data };
  }

  @Delete(':id')
  async deleteExpense(@Param('id') id: number) {
    await this.expensesService.deleteExpense(id);
    return { success: true };
  }
}
