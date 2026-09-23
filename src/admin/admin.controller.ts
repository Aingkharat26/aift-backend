import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from './admin-auth.guard';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('models')
  async getModelLimits() {
    const data = await this.adminService.getModelLimits();
    return { success: true, data };
  }

  @Post('ping')
  async pingModel(@Body('model') model: string) {
    const result = await this.adminService.pingModel(
      model || 'models/gemini-3.5-flash-lite',
    );
    return { success: true, data: result };
  }
}
