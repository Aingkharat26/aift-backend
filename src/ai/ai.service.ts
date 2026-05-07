import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

@Injectable()
export class AiService {
  private ai: GoogleGenAI;
  private readonly logger = new Logger(AiService.name);

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY') || '';
    this.ai = new GoogleGenAI({ apiKey });
  }

  async extractExpenseData(text: string): Promise<{ item: string; amount: number; category: string; action: string }> {
    const prompt = `You are an AI Finance Tracker assistant. Your job is to extract expense information from Thai or English text.
Categories available: อาหาร, เครื่องดื่ม, เดินทาง, ช้อปปิ้ง, บันเทิง, สุขภาพ, บิล, อื่นๆ
Return EXACTLY a JSON object with this structure:
{
  "item": "Name of the item (string)",
  "amount": 0, // The price (number)
  "category": "The most appropriate category from the list above (string)",
  "action": "record_expense"
}
Text to extract: "${text}"`;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        }
      });
      
      return JSON.parse(response.text || '{}');
    } catch (e) {
      this.logger.error('Error generating content from Gemini', e);
      throw new Error('Failed to extract data from AI');
    }
  }
}
