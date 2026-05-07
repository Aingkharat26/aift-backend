import {
  Controller,
  Post,
  Body,
  Get,
  Delete,
  Param,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ExpensesService } from './expenses.service';

@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post('chat')
  async processChat(@Body('text') text: string) {
    if (!text) {
      throw new BadRequestException('Text is required');
    }

    try {
      const result = await this.expensesService.processChat(text);
      return { success: true, data: result };
    } catch (error) {
      if (error.message === 'AI_COULD_NOT_UNDERSTAND') {
        throw new BadRequestException('AI_COULD_NOT_UNDERSTAND');
      }
      const status = error?.status || 500;
      if (status === 429) {
        throw new BadRequestException('AI_QUOTA_EXCEEDED');
      }

      throw new InternalServerErrorException(
        error.message || 'Internal Server Error',
      );
    }
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
