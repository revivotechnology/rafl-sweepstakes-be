const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService');
const { authenticateToken } = require('../middleware/auth');

/**
 * @route   POST /api/email/test
 * @desc    Test email functionality
 * @access  Private (Admin only)
 */
router.post('/test', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
    }

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Send test email
    const result = await emailService.sendTestEmail(email);

    res.status(200).json({
      success: true,
      message: 'Test email sent successfully',
      data: result
    });

  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test email',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/email/send-waitlist-welcome
 * @desc    Send waitlist welcome email to user
 * @access  Private (Admin only)
 */
router.post('/send-waitlist-welcome', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
    }

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Send waitlist welcome email
    const result = await emailService.sendWaitlistWelcomeEmail(email);

    res.status(200).json({
      success: true,
      message: 'Waitlist welcome email sent successfully',
      data: result
    });

  } catch (error) {
    console.error('Waitlist welcome email error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send waitlist welcome email',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/email/send-welcome
 * @desc    Send welcome email to user
 * @access  Private (Admin only)
 */
router.post('/send-welcome', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
    }

    const { email, promoName, entryId } = req.body;

    if (!email || !promoName || !entryId) {
      return res.status(400).json({
        success: false,
        message: 'Email, promoName, and entryId are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Send welcome email
    const result = await emailService.sendWelcomeEmail(email, promoName, entryId);

    res.status(200).json({
      success: true,
      message: 'Welcome email sent successfully',
      data: result
    });

  } catch (error) {
    console.error('Welcome email error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send welcome email',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/email/send-winner
 * @desc    Send winner notification email
 * @access  Private (Admin only)
 */
router.post('/send-winner', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
    }

    const { email, promoName, prize, entryId } = req.body;

    if (!email || !promoName || !prize || !entryId) {
      return res.status(400).json({
        success: false,
        message: 'Email, promoName, prize, and entryId are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Send winner email
    const result = await emailService.sendWinnerEmail(email, promoName, prize, entryId);

    res.status(200).json({
      success: true,
      message: 'Winner email sent successfully',
      data: result
    });

  } catch (error) {
    console.error('Winner email error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send winner email',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/email/send-admin-notification
 * @desc    Send admin notification email
 * @access  Private (Admin only)
 */
router.post('/send-admin-notification', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
    }

    const { subject, message, data } = req.body;

    if (!subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Subject and message are required'
      });
    }

    // Send admin notification
    const result = await emailService.sendAdminNotification(subject, message, data);

    res.status(200).json({
      success: true,
      message: 'Admin notification sent successfully',
      data: result
    });

  } catch (error) {
    console.error('Admin notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send admin notification',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/email/config
 * @desc    Get email configuration status
 * @access  Private (Admin only)
 */
router.get('/config', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
    }

    const config = {
      sendgridConfigured: !!process.env.SENDGRID_API_KEY,
      fromEmail: process.env.FROM_EMAIL || 'noreply@rafl.com',
      fromName: process.env.FROM_NAME || 'Rafl Sweepstakes',
      replyTo: process.env.REPLY_TO_EMAIL || process.env.FROM_EMAIL || 'noreply@rafl.com',
      adminEmails: process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',').map(email => email.trim()) : [],
      smtpConfigured: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
    };

    res.status(200).json({
      success: true,
      data: config
    });

  } catch (error) {
    console.error('Email config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get email configuration',
      error: error.message
    });
  }
});

module.exports = router;
