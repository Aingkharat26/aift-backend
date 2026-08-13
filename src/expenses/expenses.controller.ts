import {
  Controller,
  Post,
  Body,
  Get,
  Delete,
  Patch,
  Param,
  Query,
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
  async getDaily(@Query('date') date?: string) {
    const data = await this.expensesService.getDailyExpenses(date);
    return { success: true, data };
  }

  @Get('summary')
  async getSummary(
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const data = await this.expensesService.getMonthlySummary(
      year ? parseInt(year) : undefined,
      month ? parseInt(month) : undefined,
    );
    return { success: true, data };
  }

  @Patch(':id')
  async updateExpense(
    @Param('id') id: number,
    @Body() data: { item?: string; amount?: number; category?: string },
  ) {
    const result = await this.expensesService.updateExpense(id, data);
    return { success: true, data: result };
  }

  @Delete(':id')
  async deleteExpense(@Param('id') id: number) {
    await this.expensesService.deleteExpense(id);
    return { success: true };
  }
}
