import { Router } from 'express';
import { 
  getCountries, 
  getCountryByCode, 
  getExchangeRates, 
  convertCurrency, 
  getGateways, 
  getPaymentQuote, 
  initiateGlobalPayment,
  getArtistEscrow,
  requestArtistWithdrawal,
  getMasterEscrowOverview,
  getMasterEscrowTransactions,
  approveEscrowWithdrawal,
  rejectEscrowWithdrawal
} from '../controllers/globalPaymentController';
import { authenticate, checkRole } from '../middleware/auth';

const router = Router();

// Country & Currency Catalog
router.get('/countries', getCountries);
router.get('/countries/:code', getCountryByCode);
router.get('/exchange-rates', getExchangeRates);
router.get('/currency/convert', convertCurrency);

// Payment Routing & Calculation
router.get('/payment/gateways', getGateways);
router.post('/payment/quote', getPaymentQuote);
router.post('/payment/initiate', authenticate, initiateGlobalPayment);

// Artist Escrow Wallet & Payouts
router.get('/escrow/artist/wallet', authenticate, getArtistEscrow);
router.post('/escrow/artist/withdraw', authenticate, requestArtistWithdrawal);

// Master Admin Escrow Management & Settlement
router.get('/admin/escrow/overview', authenticate, getMasterEscrowOverview);
router.get('/admin/escrow/transactions', authenticate, getMasterEscrowTransactions);
router.post('/admin/escrow/withdrawals/:id/approve', authenticate, approveEscrowWithdrawal);
router.post('/admin/escrow/withdrawals/:id/reject', authenticate, rejectEscrowWithdrawal);

export default router;
