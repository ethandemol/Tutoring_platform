import express from 'express';
import { body, validationResult } from 'express-validator';
import { Feedback } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Validation middleware
const validateFeedback = [
  body('feedbackType')
    .isIn(['bug', 'feature', 'layout', 'other'])
    .withMessage('Feedback type must be one of: bug, feature, layout, other'),
  body('feedback')
    .isString()
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Feedback must be between 1 and 2000 characters'),
];

// Submit feedback
router.post('/submit', authenticate, validateFeedback, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { feedbackType, feedback } = req.body;
    const user = req.user;

    // Store feedback in database
    const feedbackRecord = await Feedback.create({
      feedbackType,
      feedback,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      status: 'pending'
    });

    res.json({
      success: true,
      message: 'Feedback submitted successfully',
      data: {
        id: feedbackRecord.id,
        feedbackType,
        submittedAt: feedbackRecord.createdAt,
      },
    });

  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit feedback',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

// Get all feedback (admin only)
router.get('/admin/all', authenticate, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.',
      });
    }

    const feedback = await Feedback.findAll({
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: req.user.constructor,
          as: 'user',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    res.json({
      success: true,
      data: feedback,
    });

  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feedback',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

// Update feedback status (admin only)
router.patch('/admin/:id/status', authenticate, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.',
      });
    }

    const { id } = req.params;
    const { status, adminNotes } = req.body;

    const feedback = await Feedback.findByPk(id);
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found',
      });
    }

    await feedback.update({
      status: status || feedback.status,
      adminNotes: adminNotes || feedback.adminNotes
    });

    res.json({
      success: true,
      message: 'Feedback status updated successfully',
      data: feedback,
    });

  } catch (error) {
    console.error('Error updating feedback status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update feedback status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

export default router; 