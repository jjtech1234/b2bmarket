import { MailService } from '@sendgrid/mail';
import nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  resetToken?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  console.log(`=== EMAIL SEND ATTEMPT ===`);
  console.log(`To: ${options.to}`);
  console.log(`Subject: ${options.subject}`);
  console.log(`EMAIL_USER available: ${!!process.env.EMAIL_USER}`);
  console.log(`EMAIL_PASS available: ${!!process.env.EMAIL_PASS}`);
  
  // REAL EMAIL DELIVERY - Try multiple providers
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    console.log(`Attempting real email delivery with: ${process.env.EMAIL_USER}`);
    
    // Determine email provider
    const emailDomain = process.env.EMAIL_USER.toLowerCase();
    const isGmail = emailDomain.includes('@gmail.com');
    const isOutlook = emailDomain.includes('@outlook.') || emailDomain.includes('@hotmail.') || emailDomain.includes('@live.');
    
    // Try provider-specific configurations
    const providers = [];
    
    if (isGmail) {
      providers.push(
        {
          name: 'Gmail Service',
          config: { service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } }
        },
        {
          name: 'Gmail SMTP',
          config: { host: 'smtp.gmail.com', port: 587, secure: false, auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } }
        }
      );
    } else if (isOutlook) {
      providers.push(
        {
          name: 'Outlook Service',
          config: { service: 'outlook', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } }
        },
        {
          name: 'Outlook SMTP',
          config: { host: 'smtp-mail.outlook.com', port: 587, secure: false, auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } }
        }
      );
    } else {
      // Generic SMTP
      providers.push({
        name: 'Generic SMTP',
        config: { host: 'smtp.gmail.com', port: 587, secure: false, auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } }
      });
    }
    
    // Try each provider configuration
    for (const provider of providers) {
      try {
        console.log(`Trying ${provider.name}...`);
        const transporter = nodemailer.createTransport(provider.config);
        
        const result = await transporter.sendMail({
          from: `"B2B Market" <${process.env.EMAIL_USER}>`,
          to: options.to,
          subject: options.subject,
          html: options.html,
        });
        
        console.log(`🎉 SUCCESS: Real email sent via ${provider.name} to ${options.to}`);
        console.log(`Message ID: ${result.messageId}`);
        if (result.response) console.log(`Response: ${result.response}`);
        return true;
        
      } catch (error: any) {
        console.log(`${provider.name} failed: ${error.message}`);
        if (error.code) console.log(`Error code: ${error.code}`);
        
        // Provide specific guidance for Gmail app password
        if (isGmail && error.code === 'EAUTH') {
          console.log(`🔧 Gmail Fix: Generate an App Password at https://myaccount.google.com/security`);
          console.log(`🔧 Use the 16-character app password instead of your regular password`);
        }
      }
    }
    
    console.log(`❌ All ${providers.length} email provider(s) failed`);
  } else {
    console.log(`❌ CRITICAL: No email credentials provided!`);
    console.log(`Please set EMAIL_USER and EMAIL_PASS environment variables`);
  }
  
  // FALLBACK - Only for development/testing
  console.log(`⚠️ Falling back to test email service - NO REAL EMAIL WILL BE SENT`);
  try {
    const testAccount = await nodemailer.createTestAccount();
    
    const transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    
    const info = await transporter.sendMail({
      from: '"B2B Market" <noreply@b2bmarket.com>',
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
    
    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log(`📧 Preview email created: ${previewUrl}`);
    console.log(`❌ WARNING: This is only a preview - no real email sent to ${options.to}`);
    
    // Return false to indicate no real email was sent
    return false;
    
  } catch (error) {
    console.error('❌ All email methods failed completely:', error);
    return false;
  }
}

export function createPasswordResetEmail(email: string, resetToken: string): EmailOptions {
  const resetUrl = `http://localhost:5000/reset-password?token=${resetToken}`;
  
  return {
    to: email,
    subject: 'Reset Your Password - B2B Market',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Reset Your Password</h2>
        <p>You requested to reset your password for your B2B Market account.</p>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}" style="display: inline-block; background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0;">Reset Password</a>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${resetUrl}</p>
        <p>This link will expire in 1 hour for security reasons.</p>
        <p>If you didn't request this password reset, please ignore this email.</p>
        <hr style="margin: 30px 0;">
        <p style="color: #666; font-size: 14px;">B2B Market Team</p>
      </div>
    `,
    resetToken
  };
}