import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');
    
    if (!smtpUser || !smtpPass) {
      throw new Error('SMTP_USER and SMTP_PASS must be defined in environment variables');
    }
    
    const smtpHost = this.configService.get<string>('SMTP_HOST', 'smtp.gmail.com');
    const smtpPort = this.configService.get<number>('SMTP_PORT', 587);
    
    // Auto-detect secure mode based on port
    // Port 465 = SSL (secure: true), Port 587 = STARTTLS (secure: false)
    // If SMTP_SECURE is explicitly set, use it; otherwise auto-detect from port
    const explicitSecure = this.configService.get<boolean | string>('SMTP_SECURE');
    let smtpSecure: boolean;
    
    if (explicitSecure !== undefined) {
      // Handle both boolean and string values from .env
      if (typeof explicitSecure === 'string') {
        smtpSecure = explicitSecure.toLowerCase() === 'true';
      } else {
        smtpSecure = explicitSecure;
      }
    } else {
      // Auto-detect: 465 = SSL, 587 = STARTTLS
      smtpSecure = smtpPort === 465;
    }
    
    // Auto-correct common misconfigurations
    if (smtpPort === 587 && smtpSecure) {
      this.logger.warn('⚠️  Port 587 detected with secure: true. Auto-correcting to secure: false (STARTTLS)...');
      smtpSecure = false;
    }
    if (smtpPort === 465 && !smtpSecure) {
      this.logger.warn('⚠️  Port 465 detected with secure: false. Auto-correcting to secure: true (SSL)...');
      smtpSecure = true;
    }
    
    this.logger.log(`Initializing SMTP connection: ${smtpHost}:${smtpPort} (secure: ${smtpSecure}${smtpPort === 587 ? ' - STARTTLS' : ' - SSL'})`);
    
    // Initialize nodemailer transporter with improved connection settings
    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure, // true for 465 (SSL), false for 587 (STARTTLS)
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      // Connection pool options
      pool: true,
      maxConnections: 1,
      maxMessages: 3,
      // Timeout settings (increased for better reliability)
      connectionTimeout: 30000, // 30 seconds
      greetingTimeout: 30000, // 30 seconds
      socketTimeout: 30000, // 30 seconds
      // Retry settings
      retry: {
        attempts: 3,
        delay: 2000, // 2 seconds between retries
      },
      // TLS options for better compatibility
      // For port 465 (SSL), these settings apply to the secure connection
      // For port 587 (STARTTLS), these apply when upgrading to TLS
      tls: {
        rejectUnauthorized: false, // Accept self-signed certificates (use true in production with valid certs)
        minVersion: 'TLSv1.2', // Use TLS 1.2 or higher (required for Gmail)
      },
      // Require TLS for STARTTLS connections (port 587)
      requireTLS: smtpPort === 587,
      // Debug mode (set to true for detailed logging)
      debug: this.configService.get<boolean>('SMTP_DEBUG', false),
    });

    // Verify connection on startup (non-blocking, don't await)
    // Only verify if SMTP_VERIFY_ON_STARTUP is true (default: false to avoid blocking startup)
    const verifyOnStartup = this.configService.get<boolean>('SMTP_VERIFY_ON_STARTUP', false);
    if (verifyOnStartup) {
      this.verifyConnection().catch(() => {
        // Error already logged in verifyConnection
      });
    } else {
      this.logger.log('SMTP connection verification skipped on startup (set SMTP_VERIFY_ON_STARTUP=true to enable)');
    }
  }

  /**
   * Verify SMTP connection
   */
  private async verifyConnection(): Promise<void> {
    try {
      this.logger.log('Verifying SMTP connection...');
      await this.transporter.verify();
      this.logger.log('✅ SMTP connection verified successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = error instanceof Error && 'code' in error ? (error as any).code : '';

      this.logger.error(
        `❌ SMTP connection verification failed: ${errorMessage}${errorCode ? ` (${errorCode})` : ''}`,
      );
    }
  }

  async sendOtpEmail(to: string, otpCode: string, fullName: string): Promise<void> {
    const mailOptions = {
      from: this.configService.get<string>('SMTP_FROM', 'noreply@pms.com'),
      to,
      subject: 'Email Verification - OTP Code',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px;">
            <h2 style="color: #333; margin-top: 0;">Email Verification</h2>
            <p>Hello ${fullName},</p>
            <p>Thank you for registering with us. Please use the following OTP code to verify your email address:</p>
            <div style="background-color: #fff; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
              <h1 style="color: #007bff; font-size: 32px; letter-spacing: 5px; margin: 0;">${otpCode}</h1>
            </div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you didn't request this code, please ignore this email.</p>
            <p style="margin-top: 30px; color: #666; font-size: 12px;">
              Best regards,<br>
              PMS Team
            </p>
          </div>
        </body>
        </html>
      `,
    };

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Don't verify connection before each send (too slow and can cause timeouts)
        // The connection will be established automatically when sending
        await this.transporter.sendMail(mailOptions);
        this.logger.log(`OTP email sent successfully to ${to}`);
        return; // Success, exit function
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `Failed to send OTP email to ${to} (attempt ${attempt}/${maxRetries}):`,
          error instanceof Error ? error.message : error,
        );

        // If it's the last attempt, throw the error
        if (attempt === maxRetries) {
          this.logger.error(`Failed to send OTP email to ${to} after ${maxRetries} attempts`);
          
          // Provide helpful error message
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          if (errorMessage.includes('socket') || errorMessage.includes('ECONNREFUSED')) {
            throw new Error(
              'Email service connection failed. Please check SMTP configuration (host, port, credentials).',
            );
          } else if (errorMessage.includes('authentication')) {
            throw new Error(
              'Email authentication failed. Please check SMTP_USER and SMTP_PASS credentials.',
            );
          } else {
            throw new Error(`Failed to send email: ${errorMessage}`);
          }
        }

        // Wait before retrying (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // This should never be reached, but TypeScript needs it
    if (lastError) {
      throw lastError;
    }
  }

  async sendDeviceVerificationEmail(to: string, otpCode: string, fullName: string, ipAddress: string): Promise<void> {
    const mailOptions = {
      from: this.configService.get<string>('SMTP_FROM', 'noreply@pms.com'),
      to,
      subject: 'New Device Verification - OTP Code',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px;">
            <h2 style="color: #333; margin-top: 0;">New Device Verification</h2>
            <p>Hello ${fullName},</p>
            <p>We detected a login attempt from a new device with IP address: <strong>${ipAddress}</strong></p>
            <p>Please use the following OTP code to verify this device:</p>
            <div style="background-color: #fff; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
              <h1 style="color: #007bff; font-size: 32px; letter-spacing: 5px; margin: 0;">${otpCode}</h1>
            </div>
            <p>This code will expire in 10 minutes.</p>
            <p>If this wasn't you, please secure your account immediately.</p>
            <p style="margin-top: 30px; color: #666; font-size: 12px;">
              Best regards,<br>
              PMS Team
            </p>
          </div>
        </body>
        </html>
      `,
    };

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.transporter.sendMail(mailOptions);
        this.logger.log(`Device verification OTP email sent successfully to ${to}`);
        return; // Success, exit function
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `Failed to send device verification OTP email to ${to} (attempt ${attempt}/${maxRetries}):`,
          error instanceof Error ? error.message : error,
        );

        // If it's the last attempt, throw the error
        if (attempt === maxRetries) {
          this.logger.error(`Failed to send device verification OTP email to ${to} after ${maxRetries} attempts`);
          
          // Provide helpful error message
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          if (errorMessage.includes('socket') || errorMessage.includes('ECONNREFUSED')) {
            throw new Error(
              'Email service connection failed. Please check SMTP configuration (host, port, credentials).',
            );
          } else if (errorMessage.includes('authentication')) {
            throw new Error(
              'Email authentication failed. Please check SMTP_USER and SMTP_PASS credentials.',
            );
          } else {
            throw new Error(`Failed to send email: ${errorMessage}`);
          }
        }

        // Wait before retrying (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // This should never be reached, but TypeScript needs it
    if (lastError) {
      throw lastError;
    }
  }
}

