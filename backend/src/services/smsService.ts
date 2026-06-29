import { logger } from '../lib/logger';

export interface SmsServiceConfig {
  accountSid?: string;
  authToken?: string;
  fromNumber?: string;
}

export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class SmsService {
  private twilioClient: any;
  private fromNumber: string | undefined;
  private enabled: boolean;
  private readonly initPromise: Promise<void>;

  constructor(config: SmsServiceConfig) {
    this.enabled = !!(config.accountSid && config.authToken && config.fromNumber);
    this.fromNumber = config.fromNumber;

    if (this.enabled) {
      // Lazy load Twilio SDK only if credentials are provided
      this.initPromise = this.initTwilioClient(config.accountSid as string, config.authToken as string);
    } else {
      logger.info('[sms-service] SMS service disabled (missing credentials)');
      this.initPromise = Promise.resolve();
    }
  }

  private async initTwilioClient(accountSid: string, authToken: string): Promise<void> {
    try {
      const { default: twilio } = await import('twilio');
      this.twilioClient = twilio(accountSid, authToken);
      logger.info('[sms-service] Twilio SMS service initialized');
    } catch (error) {
      logger.warn('[sms-service] Twilio SDK not available, SMS notifications will be disabled');
      this.enabled = false;
    }
  }

  async send(to: string, message: string): Promise<SmsResult> {
    await this.initPromise;

    if (!this.enabled) {
      logger.warn('[sms-service] SMS send attempted but service is disabled');
      return {
        success: false,
        error: 'SMS service not configured',
      };
    }

    try {
      const result = await this.twilioClient.messages.create({
        body: message,
        from: this.fromNumber,
        to,
      });

      logger.info(`[sms-service] SMS sent successfully to ${to}, messageId: ${result.sid}`);
      return {
        success: true,
        messageId: result.sid,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[sms-service] Failed to send SMS to ${to}: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

// Singleton instance
let smsServiceInstance: SmsService | null = null;

export function createSmsService(config: SmsServiceConfig): SmsService {
  smsServiceInstance = new SmsService(config);
  return smsServiceInstance;
}

export function getSmsService(): SmsService {
  if (!smsServiceInstance) {
    // Create with empty config if not initialized
    smsServiceInstance = new SmsService({});
  }
  return smsServiceInstance;
}
