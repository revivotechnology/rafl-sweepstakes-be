const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');

// Configure SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * Email Service for Rafl Sweepstakes
 * Supports both SendGrid API and SMTP for flexibility
 */
class EmailService {
  constructor() {
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@rafl.com';
    this.fromName = process.env.FROM_NAME || 'Rafl Sweepstakes';
    this.replyTo = process.env.REPLY_TO_EMAIL || this.fromEmail;
    
    // Initialize SMTP transporter as fallback
    this.smtpTransporter = null;
    if (process.env.SMTP_HOST) {
      this.smtpTransporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    }
  }

  /**
   * Send email using SendGrid API (preferred method)
   */
  async sendWithSendGrid(to, subject, html, text = null) {
    try {
      const msg = {
        to: Array.isArray(to) ? to : [to],
        from: {
          email: this.fromEmail,
          name: this.fromName
        },
        replyTo: this.replyTo,
        subject,
        html,
        text: text || this.stripHtml(html)
      };

      const response = await sgMail.send(msg);
      console.log('Email sent successfully via SendGrid:', response[0].statusCode);
      return { success: true, messageId: response[0].headers['x-message-id'] };
    } catch (error) {
      console.error('SendGrid error:', error);
      throw new Error(`SendGrid email failed: ${error.message}`);
    }
  }

  /**
   * Send email using SMTP (fallback method)
   */
  async sendWithSMTP(to, subject, html, text = null) {
    if (!this.smtpTransporter) {
      throw new Error('SMTP not configured');
    }

    try {
      const mailOptions = {
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to: Array.isArray(to) ? to.join(', ') : to,
        replyTo: this.replyTo,
        subject,
        html,
        text: text || this.stripHtml(html)
      };

      const info = await this.smtpTransporter.sendMail(mailOptions);
      console.log('Email sent successfully via SMTP:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('SMTP error:', error);
      throw new Error(`SMTP email failed: ${error.message}`);
    }
  }

  /**
   * Send email with automatic fallback
   */
  async sendEmail(to, subject, html, text = null, useSMTP = false) {
    try {
      if (useSMTP && this.smtpTransporter) {
        return await this.sendWithSMTP(to, subject, html, text);
      } else {
        return await this.sendWithSendGrid(to, subject, html, text);
      }
    } catch (error) {
      // Try fallback method if primary fails
      if (!useSMTP && this.smtpTransporter) {
        console.log('SendGrid failed, trying SMTP fallback...');
        return await this.sendWithSMTP(to, subject, html, text);
      }
      throw error;
    }
  }

  /**
   * Send welcome email to new entry
   */
  async sendWelcomeEmail(email, promoName, entryId) {
    const subject = `Welcome to ${promoName} - Entry Confirmed!`;
    const html = this.getWelcomeEmailTemplate(email, promoName, entryId);
    
    return await this.sendEmail(email, subject, html);
  }

  /**
   * Send waitlist welcome email
   */
  async sendWaitlistWelcomeEmail(email) {
    const subject = `Welcome to Rafl Sweepstakes - You're on the list!`;
    const html = this.getWaitlistWelcomeEmailTemplate(email);
    
    return await this.sendEmail(email, subject, html);
  }

  /**
   * Send winner notification email
   */
  async sendWinnerEmail(email, promoName, prize, entryId) {
    const subject = `🎉 Congratulations! You won ${prize} in ${promoName}`;
    const html = this.getWinnerEmailTemplate(email, promoName, prize, entryId);
    
    return await this.sendEmail(email, subject, html);
  }

  /**
   * Send admin notification email
   */
  async sendAdminNotification(subject, message, data = {}) {
    const adminEmails = process.env.ADMIN_EMAILS ? 
      process.env.ADMIN_EMAILS.split(',').map(email => email.trim()) : 
      [];
    
    if (adminEmails.length === 0) {
      console.log('No admin emails configured for notifications');
      return { success: false, message: 'No admin emails configured' };
    }

    const html = this.getAdminNotificationTemplate(subject, message, data);
    return await this.sendEmail(adminEmails, `[Admin] ${subject}`, html);
  }

  /**
   * Test email functionality
   */
  async sendTestEmail(to) {
    const subject = 'Rafl Sweepstakes - Email Test';
    const html = this.getTestEmailTemplate();
    
    return await this.sendEmail(to, subject, html);
  }

  // Email Templates
  getWelcomeEmailTemplate(email, promoName, entryId) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to ${promoName}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4f46e5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .entry-id { background: #e5e7eb; padding: 10px; border-radius: 4px; font-family: monospace; }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
          .unsubscribe { font-size: 12px; color: #9ca3af; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to ${promoName}!</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            
            <p>Thank you for entering <strong>${promoName}</strong>. Your entry has been successfully registered!</p>
            
            <p>Your entry details:</p>
            <div class="entry-id">Entry ID: ${entryId}</div>
            
            <p>We will notify you if you are selected as a winner. Good luck!</p>
            
            <p>If you have any questions, please reply to this email.</p>
            
            <p>Best regards,<br>The Rafl Sweepstakes Team</p>
          </div>
          <div class="footer">
            <p>This email was sent to ${email}</p>
            <p>© 2024 Rafl Sweepstakes. All rights reserved.</p>
            <div class="unsubscribe">
              <p>If you no longer wish to receive these emails, please reply with "UNSUBSCRIBE"</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getWinnerEmailTemplate(email, promoName, prize, entryId) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>You Won ${prize}!</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .prize { background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0; }
          .entry-id { background: #e5e7eb; padding: 10px; border-radius: 4px; font-family: monospace; }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Congratulations! You're a Winner!</h1>
          </div>
          <div class="content">
            <p>Hello!</p>
            <p>We're excited to announce that you've won a prize in <strong>${promoName}</strong>!</p>
            
            <div class="prize">
              <h3>🏆 Your Prize:</h3>
              <p><strong>${prize}</strong></p>
            </div>
            
            <h3>Entry Details:</h3>
            <div class="entry-id">Entry ID: ${entryId}</div>
            
            <p>Please reply to this email within 7 days to claim your prize. We'll provide you with instructions on how to receive your winnings.</p>
            
            <p>Congratulations again!</p>
            <p>Best regards,<br>The Rafl Team</p>
          </div>
          <div class="footer">
            <p>This email was sent to ${email}</p>
            <p>© 2024 Rafl Sweepstakes. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getAdminNotificationTemplate(subject, message, data) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Admin Notification</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .data { background: #e5e7eb; padding: 15px; border-radius: 4px; font-family: monospace; white-space: pre-wrap; }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔔 Admin Notification</h1>
          </div>
          <div class="content">
            <h2>${subject}</h2>
            <p>${message}</p>
            
            ${Object.keys(data).length > 0 ? `
            <h3>Additional Data:</h3>
            <div class="data">${JSON.stringify(data, null, 2)}</div>
            ` : ''}
            
            <p>Timestamp: ${new Date().toISOString()}</p>
          </div>
          <div class="footer">
            <p>Rafl Sweepstakes Admin System</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getWaitlistWelcomeEmailTemplate(email) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Rafl Sweepstakes</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4f46e5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .welcome { background: #dbeafe; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6; margin: 20px 0; }
          .features { background: #f0fdf4; padding: 15px; border-radius: 8px; border-left: 4px solid #22c55e; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to Rafl Sweepstakes!</h1>
          </div>
          <div class="content">
            <p>Hello!</p>
            
            <div class="welcome">
              <h3>🎯 You're on the list!</h3>
              <p>Thank you for joining the Rafl Sweepstakes waitlist. You're now part of our exclusive community of sweepstakes enthusiasts!</p>
            </div>
            
            <p>We're excited to have you on board. Here's what you can expect:</p>
            
            <div class="features">
              <h3>🚀 What's Coming:</h3>
              <ul>
                <li><strong>Exclusive Giveaways:</strong> Access to special sweepstakes before they go public</li>
                <li><strong>Early Access:</strong> Be the first to know about new promotions and prizes</li>
                <li><strong>Special Rewards:</strong> Bonus entries and exclusive perks for waitlist members</li>
                <li><strong>No Spam:</strong> We only send you important updates and opportunities</li>
              </ul>
            </div>
            
            <p>We'll notify you as soon as we launch new sweepstakes and exciting opportunities!</p>
            
            <p>Best regards,<br>The Rafl Team</p>
          </div>
          <div class="footer">
            <p>This email was sent to ${email}</p>
            <p>© 2024 Rafl Sweepstakes. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getTestEmailTemplate() {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Test</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4f46e5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .success { background: #d1fae5; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981; }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Email Test Successful</h1>
          </div>
          <div class="content">
            <div class="success">
              <h3>🎉 Congratulations!</h3>
              <p>Your email configuration is working correctly!</p>
            </div>
            
            <p>This test email was sent from the Rafl Sweepstakes backend system.</p>
            
            <h3>Configuration Details:</h3>
            <ul>
              <li><strong>From Email:</strong> ${this.fromEmail}</li>
              <li><strong>From Name:</strong> ${this.fromName}</li>
              <li><strong>Reply To:</strong> ${this.replyTo}</li>
              <li><strong>SendGrid API:</strong> ${process.env.SENDGRID_API_KEY ? '✅ Configured' : '❌ Not configured'}</li>
              <li><strong>SMTP Fallback:</strong> ${this.smtpTransporter ? '✅ Configured' : '❌ Not configured'}</li>
            </ul>
            
            <p>You can now send emails to users for:</p>
            <ul>
              <li>Entry confirmations</li>
              <li>Winner notifications</li>
              <li>Admin alerts</li>
              <li>And more!</li>
            </ul>
          </div>
          <div class="footer">
            <p>Test sent at: ${new Date().toISOString()}</p>
            <p>© 2024 Rafl Sweepstakes. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Strip HTML tags to create plain text version
   */
  stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }
}

module.exports = new EmailService();
