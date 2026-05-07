import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
@Injectable()
export class AiService {
  private genAI: GoogleGenerativeAI;
  private readonly logger = new Logger(AiService.name);

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY') || '';
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async extractExpenseData(text: string): Promise<any> {
    const prompt = `You are an AI Finance Tracker assistant. Your job is to extract expense information from Thai or English text.
    Categories available: อาหาร, เครื่องดื่ม, เดินทาง, ช้อปปิ้ง, บันเทิง, สุขภาพ, บิล, สัตว์เลี้ยง, อื่นๆ

    STRICT RULES:
    1. If the text mentions anything related to pets (cats, dogs, pet food, sand, toys), ALWAYS use the category "สัตว์เลี้ยง".
    2. If the text mentions food or drinks for humans, use "อาหาร" or "เครื่องดื่ม".
    3. If the amount is not clearly stated, use 0.

    EXAMPLES:
    - "กะเพราไข่ดาว 60" -> {"item": "กะเพราไข่ดาว", "amount": 60, "category": "อาหาร", "action": "record_expense"}
    - "อาหารแมว 350" -> {"item": "อาหารแมว", "amount": 350, "category": "สัตว์เลี้ยง", "action": "record_expense"}

    Text to extract: "${text}"
    Return ONLY a JSON object.`;

    const model = this.genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json' } 
    });

    const maxRetries = 3;
    let delay = 1000;

    for (let i = 0; i <= maxRetries; i++) {
      try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const jsonText = response.text();
        
        return JSON.parse(jsonText);
      } catch (e: any) {
        const isRetryable = e?.status === 503 || e?.status === 429;
        
        if (isRetryable && i < maxRetries) {
          this.logger.warn(`API Busy/Unavailable, retrying... Attempt ${i + 1}`);
          await new Promise(r => setTimeout(r, delay));
          delay *= 2;
          continue;
        }

        this.logger.error(`Gemini Error: ${e.message}`, e.stack);
        throw new Error('AI extraction failed');
      }
    }
  }
}