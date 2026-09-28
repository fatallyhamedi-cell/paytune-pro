import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { getDbStore, notifyMutation } from '../config/supabase_mock';
import { 
  COUNTRIES, 
  EXCHANGE_RATES, 
  calculateGlobalQuote, 
  findCountry, 
  getGatewaysForCountry, 
  convertRwfToCurrency,
  convertCurrencyToRwf
} from '../services/currencyService';
import { processEscrowPurchase, getArtistWalletOverview, getPlatformEscrowOverview } from '../services/escrowService';

/**
 * GET /api/countries
 * Returns supported countries with gateways and currencies
 */
export const getCountries = async (req: Request, res: Response) => {
  try {
    const store = getDbStore();
    const dbCountries = store.countries || [];
    
    // Merge database countries with rich metadata from COUNTRIES
    const merged = COUNTRIES.map(c => {
      const dbMatch = dbCountries.find((dc: any) => dc.iso2 === c.iso2);
      return {
        ...c,
        is_active: dbMatch ? dbMatch.is_active : c.is_active
      };
    });

    res.json(merged);
  } catch (err: any) {
    console.error("getCountries error:", err);
    res.status(500).json({ error: "Failed to load countries" });
  }
};

/**
 * GET /api/countries/:code
 * Get country by ISO2, ISO3, or code
 */
export const getCountryByCode = async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const country = findCountry(code);
    const gateways = getGatewaysForCountry(country.iso2);
    const rate = EXCHANGE_RATES[country.currency_code] || EXCHANGE_RATES['USD'];

    res.json({
      country,
      gateways,
      exchange_rate: rate
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/exchange-rates
 * Returns all current exchange rates relative to RWF base
 */
export const getExchangeRates = async (req: Request, res: Response) => {
  try {
    res.json({
      base_currency: 'RWF',
      rates: EXCHANGE_RATES,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/currency/convert
 * Query: ?amount=1000&from=RWF&to=USD
 */
export const convertCurrency = async (req: Request, res: Response) => {
  try {
    const amount = Number(req.query.amount) || 1000;
    const from = String(req.query.from || 'RWF').toUpperCase();
    const to = String(req.query.to || 'USD').toUpperCase();

    let rwfBase = amount;
    if (from !== 'RWF') {
      rwfBase = convertCurrencyToRwf(amount, from);
    }

    const result = convertRwfToCurrency(rwfBase, to);
    res.json({
      from,
      to,
      original_amount: amount,
      rwf_base: rwfBase,
      converted_amount: result.amount,
      formatted: result.formatted,
      exchange_rate: EXCHANGE_RATES[to]?.rate_to_rwf || 1.0
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/payment/gateways
 * Query: ?country=KE
 */
export const getGateways = async (req: Request, res: Response) => {
  try {
    const countryCode = String(req.query.country || 'RW').toUpperCase();
    const country = findCountry(countryCode);
    const gateways = getGatewaysForCountry(country.iso2);

    res.json({
      country,
      currency: country.currency_code,
      gateways
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/payment/quote
 * Body: { basePriceRwf, countryCode }
 */
export const getPaymentQuote = async (req: Request, res: Response) => {
  try {
    const { basePriceRwf = 1000, countryCode = 'RW' } = req.body;
    const quote = calculateGlobalQuote(Number(basePriceRwf), countryCode);
    res.json(quote);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/payment/initiate
 * Global checkout with Escrow routing
 */
export const initiateGlobalPayment = async (req: Request, res: Response) => {
  const {
    videoId,
    countryCode = 'RW',
    gateway = 'MTN MoMo',
    paymentPhone,
    paymentAccount,
    amount,
    currency
  } = req.body;

  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: "Authentication required to make a purchase." });
  }

  if (!videoId) {
    return res.status(400).json({ error: "videoId is required" });
  }

  try {
    const result = await processEscrowPurchase({
      userId: user.id,
      videoId,
      countryCode,
      gateway,
      paymentPhone,
      paymentAccount,
      amount,
      currency
    });

    res.json({
      success: true,
      message: "Payment successfully secured in PAYTUNE Escrow. Lifetime access granted.",
      ...result
    });
  } catch (err: any) {
    console.error("initiateGlobalPayment error:", err);
    res.status(500).json({ error: err.message || "Payment initiation failed." });
  }
};

/**
 * GET /api/escrow/artist/wallet
 * Returns current artist's escrow wallet status
 */
export const getArtistEscrow = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Resolve artist ID
    const store = getDbStore();
    let artistId = req.query.artistId as string;
    if (!artistId) {
      const found = (store.artists || []).find((a: any) => a.user_id === user.id || a.id === user.id || a.email === user.email);
      artistId = found ? found.id : 'artist-1';
    }

    const overview = await getArtistWalletOverview(artistId);
    res.json(overview);
  } catch (err: any) {
    console.error("getArtistEscrow error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/escrow/artist/withdraw
 * Request payout from artist wallet
 */
export const requestArtistWithdrawal = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const {
    amount,
    payout_method = 'MTN Mobile Money',
    phone,
    account_number,
    account_name,
    payout_currency = 'RWF',
    artistId: customArtistId
  } = req.body;

  try {
    const store = getDbStore();
    let artist = (store.artists || []).find((a: any) => 
      a.id === customArtistId || a.user_id === user.id || a.id === user.id || a.email === user.email
    );
    if (!artist && store.artists?.length > 0) {
      artist = store.artists[0];
    }

    if (!artist) {
      return res.status(404).json({ error: "Artist profile not found" });
    }

    const withdrawAmountRwf = Number(amount);
    if (!withdrawAmountRwf || isNaN(withdrawAmountRwf) || withdrawAmountRwf <= 0) {
      return res.status(400).json({ error: "Please enter a valid withdrawal amount." });
    }

    const minThreshold = 5000;
    if (withdrawAmountRwf < minThreshold) {
      return res.status(400).json({ error: `Minimum withdrawal is ${minThreshold.toLocaleString()} RWF.` });
    }

    const currentBalance = Number(artist.pending_balance ?? 0);
    if (currentBalance < withdrawAmountRwf) {
      return res.status(400).json({ 
        error: `Insufficient balance. Available: ${currentBalance.toLocaleString()} RWF, requested: ${withdrawAmountRwf.toLocaleString()} RWF.` 
      });
    }

    const destination = phone || account_number || artist.phone || '0788112233';
    const refCode = `PAYTUNE-WD-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const withdrawalRecord = {
      id: `w-${Date.now()}`,
      artist_id: artist.id,
      artist_name: artist.full_name,
      amount: withdrawAmountRwf,
      phone: destination,
      payment_method: payout_method,
      account_name: account_name || artist.full_name,
      payout_currency,
      status: 'pending',
      reference_code: refCode,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (!store.withdrawals) {
      store.withdrawals = [];
    }
    store.withdrawals.unshift(withdrawalRecord);

    // Deduct from artist available balance
    const newBalance = currentBalance - withdrawAmountRwf;
    artist.pending_balance = newBalance;

    await supabaseAdmin
      .from('artists')
      .update({ pending_balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', artist.id);

    notifyMutation(store);

    res.json({
      success: true,
      message: `Withdrawal request for ${withdrawAmountRwf.toLocaleString()} RWF submitted successfully. Funds will be sent via ${payout_method} to ${destination} upon Master approval.`,
      withdrawal: withdrawalRecord,
      new_balance: newBalance
    });
  } catch (err: any) {
    console.error("requestArtistWithdrawal error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/admin/escrow/overview
 * Master Admin Global Escrow & Settlement Metrics
 */
export const getMasterEscrowOverview = async (req: Request, res: Response) => {
  try {
    const overview = await getPlatformEscrowOverview();
    res.json(overview);
  } catch (err: any) {
    console.error("getMasterEscrowOverview error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/admin/escrow/transactions
 * Master Admin Escrow Transactions Ledger
 */
export const getMasterEscrowTransactions = async (req: Request, res: Response) => {
  try {
    const store = getDbStore();
    const transactions = store.escrow_transactions || [];
    res.json(transactions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/admin/escrow/withdrawals/:id/approve
 * Master Admin approves and settles an artist withdrawal
 */
export const approveEscrowWithdrawal = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const store = getDbStore();
    const item = (store.withdrawals || []).find((w: any) => w.id === id);
    if (!item) {
      return res.status(404).json({ error: "Withdrawal not found" });
    }

    item.status = 'completed';
    item.completed_at = new Date().toISOString();
    item.processed_by = (req as any).user?.email || 'master@paytune.com';
    item.transaction_ref = `PT-SETTLED-${Date.now()}`;

    notifyMutation(store);

    res.json({
      success: true,
      message: `Withdrawal ${id} successfully approved and disbursed. Reference: ${item.transaction_ref}`,
      withdrawal: item
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/admin/escrow/withdrawals/:id/reject
 * Master Admin rejects withdrawal and refunds balance to artist
 */
export const rejectEscrowWithdrawal = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason = 'Information mismatch' } = req.body;

  try {
    const store = getDbStore();
    const item = (store.withdrawals || []).find((w: any) => w.id === id);
    if (!item) {
      return res.status(404).json({ error: "Withdrawal not found" });
    }

    item.status = 'rejected';
    item.rejection_reason = reason;
    item.rejected_at = new Date().toISOString();
    item.processed_by = (req as any).user?.email || 'master@paytune.com';

    // Refund artist balance
    const artist = (store.artists || []).find((a: any) => a.id === item.artist_id);
    if (artist) {
      artist.pending_balance = Number(artist.pending_balance || 0) + Number(item.amount || 0);
      await supabaseAdmin
        .from('artists')
        .update({ pending_balance: artist.pending_balance })
        .eq('id', artist.id);
    }

    notifyMutation(store);

    res.json({
      success: true,
      message: `Withdrawal ${id} rejected. Funds returned to artist wallet.`,
      withdrawal: item
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
