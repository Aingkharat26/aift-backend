import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class AiService implements OnModuleInit {
  private readonly genAI: GoogleGenerativeAI;
  private readonly logger = new Logger(AiService.name);

  // ถ้าตัวแรก error (429/404/500) จะลองตัวถัดไปอัตโนมัติ
  private readonly modelPriority = [
    'models/gemini-3.5-flash-lite',
    'models/gemini-3.6-flash',
    'models/gemini-3.1-flash-lite',
    'models/gemini-2.5-flash-lite',
  ];

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY') || '';
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async onModuleInit() {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
        );
        await response.json();
        this.logger.log('--- AI Models Verified ---');
      } catch (e: any) {
        this.logger.error(`Failed to fetch models list: ${e.message || e}`);
      }
    }
  }

  async extractExpenseData(text: string): Promise<any> {
    const logLabel = `[AI Process] "${text.substring(0, 20)}${text.length > 20 ? '...' : ''}"`;
    console.time(logLabel);

    const prompt = `You are an AI Finance Tracker assistant. Your job is to extract expense information from Thai or English text.
  Categories: อาหาร, เครื่องดื่ม, เดินทาง, ช้อปปิ้ง, บันเทิง, สุขภาพ, บิล, สัตว์เลี้ยง, อื่นๆ

  STRICT RULES:
  1. If the text mentions pets (cats, dogs, pet food, sand, toys), use "สัตว์เลี้ยง".
  2. If amount is not clearly stated, use 0.
  3. Keyboard Fix: If "ถจ" appear, it means "50", "ค" means "8", "ต" means "9".
  4. If the input text is gibberish, nonsense, or contains no clear expense intent, 
     set "action" to "invalid_input" and "item" to "unknown".
  
  Text to extract: "${text}"
  Return ONLY a JSON object like: {"item": string, "amount": number, "category": string, "action": "record_expense"}`;

    for (const modelName of this.modelPriority) {
      try {
        const parsedData = await this.generateAndParseJSON(modelName, prompt);

        if (
          parsedData.action === 'invalid_input' ||
          (parsedData.amount === 0 && parsedData.item === 'unknown')
        ) {
          throw new Error('AI_COULD_NOT_UNDERSTAND');
        }

        console.timeEnd(logLabel);
        return parsedData;
      } catch (e: any) {
        if (!this.handleModelError(e, modelName)) {
          break;
        }
      }
    }

    console.timeEnd(logLabel);
    this.logger.error('All models failed to process the request.');
    throw new Error('AI_COULD_NOT_UNDERSTAND');
  }

  async generateMonthlyInsight(input: {
    monthLabel: string;
    prevLabel: string;
    currentExpenses: { category: string; total: number }[];
    currentExpenseTotal: number;
    currentIncomeTotal: number;
    previousExpenses: { category: string; total: number }[];
    previousExpenseTotal: number;
    previousIncomeTotal: number;
  }): Promise<string> {
    const fmt = (n: number) =>
      Math.round(n)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    const currentLines = input.currentExpenses.map(
      (e) => `${e.category} ${fmt(e.total)} บาท`,
    );
    const prevLines = input.previousExpenses.map(
      (e) => `${e.category} ${fmt(e.total)} บาท`,
    );

    const prompt = `คุณคือผู้ช่วยการเงินส่วนตัว วิเคราะห์และสรุปการใช้จ่ายรายเดือนให้ผู้ใช้ฟังเป็นภาษาไทย กระชับ ตรงประเด็น

ข้อมูลเดือนนี้ (${input.monthLabel}):
- ยอดใช้จ่ายรวม: ${fmt(input.currentExpenseTotal)} บาท
- รายรับรวม: ${fmt(input.currentIncomeTotal)} บาท
- รายจ่ายแยกหมวด: ${currentLines.join(', ') || 'ไม่มีข้อมูล'}

ข้อมูลเดือนก่อนหน้า (${input.prevLabel}):
- ยอดใช้จ่ายรวม: ${fmt(input.previousExpenseTotal)} บาท
- รายรับรวม: ${fmt(input.previousIncomeTotal)} บาท
- รายจ่ายแยกหมวด: ${prevLines.join(', ') || 'ไม่มีข้อมูล'}

จงเขียนสรุป 3-5 ประโยค ประกอบด้วย:
1. ภาพรวม: ใช้จ่ายไปเท่าไหร่ รายรับเท่าไหร่ เหลือหรือขาดเท่าไหร่
2. หมวดที่ใช้จ่ายสูงสุด และเทียบกับเดือนก่อนหน้าว่าเพิ่มขึ้นหรือลดลง
3. การเปลี่ยนแปลงที่โดดเด่นระหว่างเดือนนี้กับเดือนก่อนหน้า (ถ้ามีข้อมูล)
4. คำแนะนำสั้นๆ 1 ข้อ ในการประหยัดหรือจัดการเงินเดือนหน้า

ใช้ภาษาไทยเป็นกันเอง มีอีโมจิได้ไม่เกิน 2-3 ตัว และห้ามเกิน 150 คำ`;

    for (const modelName of this.modelPriority) {
      try {
        const model = this.genAI.getGenerativeModel({
          model: modelName,
          generationConfig: { temperature: 0.7, maxOutputTokens: 400 },
        });
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        if (text) return text;
      } catch (e: any) {
        this.logger.warn(
          `Model ${modelName} failed for monthly insight: ${e?.message || e}`,
        );
      }
    }

    throw new Error('AI_INSIGHT_FAILED');
  }

  async extractIncomeData(text: string): Promise<any> {
    const logLabel = `[AI Income Process] "${text.substring(0, 20)}${text.length > 20 ? '...' : ''}"`;
    console.time(logLabel);

    const prompt = `You are an AI Finance Tracker assistant. Your job is to extract INCOME information from Thai or English text.
  
  STRICT RULES:
  1. Extract the SPECIFIC source of income (e.g., "เงินเดือน", "ขายของ", "แม่ให้มา").
  2. DO NOT use generic words like "income", "รับ", or "รายรับ" as the source name unless it's the only word provided.
  3. If the user says "รายรับจากแม่ 500", the source should be "จากแม่" or "แม่ให้มา".
  4. If amount is not clearly stated, use 0.
  5. Keyboard Fix: If "ถจ" appear, it means "50", "ค" means "8", "ต" means "9".
  6. If the input text is gibberish, nonsense, or contains no clear income intent, 
     set "action" to "invalid_input" and "source" to "unknown".
  
  Text to extract: "${text}"
  Return ONLY a JSON object like: {"source": string, "amount": number, "action": "record_income"}`;

    for (const modelName of this.modelPriority) {
      try {
        const parsedData = await this.generateAndParseJSON(modelName, prompt);

        if (
          parsedData.action === 'invalid_input' ||
          (parsedData.amount === 0 && parsedData.source === 'unknown')
        ) {
          throw new Error('AI_COULD_NOT_UNDERSTAND');
        }

        console.timeEnd(logLabel);
        return parsedData;
      } catch (e: any) {
        if (e.message === 'AI_COULD_NOT_UNDERSTAND') throw e;
        continue; // Try next model
      }
    }

    console.timeEnd(logLabel);
    throw new Error('AI_COULD_NOT_UNDERSTAND');
  }

  private async generateAndParseJSON(modelName: string, prompt: string): Promise<any> {
    const model = this.genAI.getGenerativeModel({
      model: modelName,
      generationConfig: modelName.includes('gemma')
        ? {}
        : { responseMimeType: 'application/json' },
    });

    const result = await model.generateContent(prompt);
    const response = result.response;
    let jsonText = response.text().trim();

    const jsonMatch = /({[\s\S]*?})/.exec(jsonText);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    return JSON.parse(jsonText);
  }

  private handleModelError(e: any, modelName: string): boolean {
    const status = e?.status;
    const message = e?.message || '';

    if (message === 'AI_COULD_NOT_UNDERSTAND') {
      this.logger.error(`Model ${modelName} returned: AI_COULD_NOT_UNDERSTAND`);
      return false; // Stop retrying
    }

    const isRetryable =
      [429, 404, 500].includes(status) ||
      message.includes('429') ||
      message.includes('404') ||
      message.includes('500');

    if (isRetryable) {
      this.logger.warn(`Model ${modelName} failed (${status || 'Error'}), trying next...`);
      return true; // Continue retrying
    }

    this.logger.error(`Critical error with ${modelName}: ${message}`);
    return false; // Stop retrying
  }
}
