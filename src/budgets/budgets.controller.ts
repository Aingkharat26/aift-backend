import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { BudgetsService } from './budgets.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../auth/entities/user.entity';

@UseGuards(JwtAuthGuard)
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  async getAll(@CurrentUser() user: User) {
    const data = await this.budgetsService.getAll(user.id);
    return { success: true, data };
  }

  @Post()
  async upsert(
    @CurrentUser() user: User,
    @Body() body: { category?: string; limit?: number },
  ) {
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
      user.id,
    );
    return { success: true, data };
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ) {
    await this.budgetsService.remove(parseInt(id), user.id);
    return { success: true };
  }

  @Get('recommendations')
  async getRecommendations(@CurrentUser() user: User) {
    const data = await this.budgetsService.getRecommendations(user.id);
    return { success: true, data };
  }

  @Get('status')
  async getStatus(
    @CurrentUser() user: User,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const data = await this.budgetsService.getStatus(
      user.id,
      year ? parseInt(year) : undefined,
      month ? parseInt(month) : undefined,
    );
    return { success: true, data };
  }
}
