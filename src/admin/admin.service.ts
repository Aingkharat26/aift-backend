import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY') || '';
    this.genAI = new GoogleGenerativeAI(this.apiKey);
  }

  async getModelLimits() {
    // 1. Defined Waterfall Configuration in the system
    const activeModels = [
      {
        id: 'gemini-3.5-flash-lite',
        name: 'models/gemini-3.5-flash-lite',
        displayName: 'Gemini 3.5 Flash-Lite',
        priority: 1,
        status: 'Active (Primary)',
        color: 'success',
        inputTokenLimit: 1048576,
        outputTokenLimit: 65536,
        rpmQuota: 15,
        rpdQuota: 1500,
        tpmQuota: '1,000,000',
        description:
          'โมเดลหลัก: สกัดข้อมูลรายรับ-รายจ่ายและงบประมาณ ตอบสนองเร็วที่สุดและประหยัดโควตา',
      },
      {
        id: 'gemini-3.6-flash',
        name: 'models/gemini-3.6-flash',
        displayName: 'Gemini 3.6 Flash',
        priority: 2,
        status: 'Standby (Backup 1)',
        color: 'info',
        inputTokenLimit: 1048576,
        outputTokenLimit: 65536,
        rpmQuota: 15,
        rpdQuota: 1500,
        tpmQuota: '1,000,000',
        description:
          'โมเดลสำรองอันดับ 1: รองรับรูปภาพใบเสร็จและงานคำนวณที่ซับซ้อน',
      },
      {
        id: 'gemini-3.1-flash-lite',
        name: 'models/gemini-3.1-flash-lite',
        displayName: 'Gemini 3.1 Flash-Lite',
        priority: 3,
        status: 'Standby (Backup 2)',
        color: 'warning',
        inputTokenLimit: 1048576,
        outputTokenLimit: 65536,
        rpmQuota: 15,
        rpdQuota: 1500,
        tpmQuota: '1,000,000',
        description: 'โมเดลสำรองอันดับ 2: เข้าใจภาษาไทยและคำสแลงอย่างแม่นยำ',
      },
      {
        id: 'gemini-2.5-flash-lite',
        name: 'models/gemini-2.5-flash-lite',
        displayName: 'Gemini 2.5 Flash-Lite',
        priority: 4,
        status: 'Standby (Backup 3)',
        color: 'secondary',
        inputTokenLimit: 1048576,
        outputTokenLimit: 65536,
        rpmQuota: 15,
        rpdQuota: 1500,
        tpmQuota: '1,000,000',
        description: 'โมเดลสำรองระดับฐาน: มีเสถียรภาพสูง สำรองลำดับสุดท้าย',
      },
    ];

    // 2. Fetch live models from Google Generative Language API
    let liveGoogleModels: any[] = [];
    let isApiKeyValid = false;

    if (this.apiKey) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`,
        );
        const data = await res.json();
        if (data.models && Array.isArray(data.models)) {
          isApiKeyValid = true;
          liveGoogleModels = data.models
            .filter((m: any) => m.name.includes('flash') || m.name.includes('gemini'))
            .map((m: any) => ({
              name: m.name,
              displayName: m.displayName || m.name,
              inputTokenLimit: m.inputTokenLimit,
              outputTokenLimit: m.outputTokenLimit,
              description: m.description,
            }));
        }
      } catch (e: any) {
        this.logger.warn(`Could not fetch live Google models: ${e.message}`);
      }
    }

    return {
      apiKeyConfigured: Boolean(this.apiKey),
      isApiKeyValid,
      activeModels,
      liveGoogleModels,
      systemQuotas: {
        freeTierRpm: 15,
        freeTierRpd: 1500,
        freeTierTpm: 1000000,
      },
    };
  }

  async pingModel(modelName: string) {
    const startTime = Date.now();
    try {
      const model = this.genAI.getGenerativeModel({ model: modelName });
      const res = await model.generateContent('ping');
      const latencyMs = Date.now() - startTime;

      return {
        success: true,
        latencyMs,
        model: modelName,
        reply: res.response.text().trim(),
      };
    } catch (e: any) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        model: modelName,
        error: e.message || 'Ping failed',
      };
    }
  }
}
