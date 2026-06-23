const MODERATION_SYSTEM_PROMPT = `Filter laporan mati lampu Indonesia. Respon wajib JSON objek.
TOLAK (is_safe:false) jika: Toxic/SARA, atau GAK RELEVAN kelistrikan (jualan/spam/curhat).
TERIMA (is_safe:true) jika: Politik boleh dikit, Info mati lampu, gardu/kabel rusak, atau hal-hal terkait PLN.
Alasan (reason) maksimal 4 kata.
Schema: {"is_safe":boolean,"reason":string}`;

export interface ModerationInput {
  reporter_name: string;
  description: string;
}

export interface ModerationResult {
  is_safe: boolean;
  reason: string;
}

export class AiModerationService {
  private readonly apiUrl = 'https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions';
  private readonly model = 'deepseek-v4-flash-260425';

  constructor(private readonly apiKey: string) {}

  async moderate(input: ModerationInput): Promise<ModerationResult> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 60,
          temperature: 0.1,
          messages: [
            { role: 'system', content: MODERATION_SYSTEM_PROMPT },
            { role: 'user', content: JSON.stringify(input) },
          ],
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HTTP ${response.status} - ${errorBody}`);
      }

      const data = await response.json();
      const rawResult = data.choices[0].message.content as string;
      return JSON.parse(rawResult) as ModerationResult;
    } catch (error) {
      console.error('[AiModerationService] moderation failed:', error);
      return { is_safe: false, reason: 'Sistem error' };
    }
  }
}
