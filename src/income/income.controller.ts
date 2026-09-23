import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Delete,
  Patch,
  Param,
  UseGuards,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { IncomeService } from './income.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../auth/entities/user.entity';

@UseGuards(JwtAuthGuard)
@Controller('income')
export class IncomeController {
  constructor(private readonly incomeService: IncomeService) {}

  @Post('chat')
  async processChat(
    @CurrentUser() user: User,
    @Body('text') text: string,
  ) {
    if (!text) {
      throw new BadRequestException('Text is required');
    }

    try {
      const result = await this.incomeService.processChat(text, user.id);
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

  @Post()
  async create(
    @CurrentUser() user: User,
    @Body() data: { source: string; amount: number },
  ) {
    const result = await this.incomeService.create(data, user.id);
    return { success: true, data: result };
  }

  @Get('summary')
  async getMonthlySummary(
    @CurrentUser() user: User,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const y = year ? parseInt(year) : undefined;
    const m = month ? parseInt(month) : undefined;
    const total = await this.incomeService.getMonthlyIncome(user.id, y, m);
    return { success: true, data: { total } };
  }

  @Get('daily')
  async getDaily(
    @CurrentUser() user: User,
    @Query('date') date?: string,
  ) {
    const data = await this.incomeService.getDailyIncome(user.id, date);
    return { success: true, data };
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() data: { source?: string; amount?: number },
  ) {
    const result = await this.incomeService.update(
      parseInt(id),
      user.id,
      data,
    );
    return { success: true, data: result };
  }

  @Delete(':id')
  async delete(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ) {
    await this.incomeService.delete(parseInt(id), user.id);
    return { success: true };
  }
}
