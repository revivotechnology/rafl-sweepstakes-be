const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// Public routes
router.post('/signup', authController.signup);
router.post('/signin', authController.signin);
router.post('/refresh', authController.refreshToken);

// Private routes (require authentication)
router.post('/logout', authenticateToken, authController.logout);
router.get('/me', authenticateToken, authController.getCurrentUser);

module.exports = router;

