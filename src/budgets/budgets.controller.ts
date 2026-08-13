import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { BudgetsService } from './budgets.service';

@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  async getAll() {
    const data = await this.budgetsService.getAll();
    return { success: true, data };
  }

  @Post()
  async upsert(@Body() body: { category?: string; limit?: number }) {
    if (
      !body.category ||
      body.limit === undefined ||
      isNaN(body.limit) ||
      body.limit <= 0
    ) {
      throw new BadRequestException(
        'category and a positive limit are required',
      );
    }
    const data = await this.budgetsService.upsert(
      body.category.trim(),
      body.limit,
    );
    return { success: true, data };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.budgetsService.remove(parseInt(id));
    return { success: true };
  }

  @Get('recommendations')
  async getRecommendations() {
    const data = await this.budgetsService.getRecommendations();
    return { success: true, data };
  }

  @Get('status')
  async getStatus(
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const data = await this.budgetsService.getStatus(
      year ? parseInt(year) : undefined,
      month ? parseInt(month) : undefined,
    );
    return { success: true, data };
  }
}
