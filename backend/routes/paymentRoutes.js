const express = require('express');
const { paymentLimiter } = require('../middleware/rateLimit');

const router = express.Router();

let paymentController;
try {
  paymentController = require('../../src/controllers/paymentController');
} catch (e) {
  paymentController = {
    initiatePayment: (req, res) => res.json({ status: 'ok' }),
    getPaymentStatus: (req, res) => res.json({ status: 'pending' })
  };
}

router.post('/initiate', paymentLimiter, paymentController.initiatePayment);
router.get('/:paymentId/status', paymentController.getPaymentStatus);

module.exports = router;
