import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  async findAll(@CurrentUser() user: User) {
    const data = await this.categoriesService.findAll(user.id);
    return { success: true, data };
  }

  @Post()
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateCategoryDto,
  ) {
    const data = await this.categoriesService.create(dto, user.id);
    return { success: true, data };
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ) {
    const data = await this.categoriesService.update(id, dto, user.id);
    return { success: true, data };
  }

  @Delete(':id')
  async delete(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const data = await this.categoriesService.delete(id, user.id);
    return data;
  }
}
