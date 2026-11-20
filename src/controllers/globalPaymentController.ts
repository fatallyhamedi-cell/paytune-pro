import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../config/supabase';
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

export const getCountries = async (_req: Request, res: Response) => {
  try {
    res.json(COUNTRIES);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load countries' });
  }
};

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

export const getExchangeRates = async (_req: Request, res: Response) => {
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

export const getPaymentQuote = async (req: Request, res: Response) => {
  try {
    const { basePriceRwf = 1000, countryCode = 'RW' } = req.body;
    const quote = calculateGlobalQuote(Number(basePriceRwf), countryCode);
    res.json(quote);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

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
  if (!user?.id) {
    return res.status(401).json({ error: 'Authentication required to make a purchase.' });
  }

  if (!videoId) {
    return res.status(400).json({ error: 'videoId is required' });
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

    res.json(result);
  } catch (err: any) {
    const status = err.statusCode || 500;
    console.error('initiateGlobalPayment error:', err);
    res.status(status).json({
      error: err.message || 'Payment initiation failed.',
      provider_configured: err.provider_configured
    });
  }
};

export const getArtistEscrow = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let channelId = (req.query.artistId as string) || '';
    if (!channelId) {
      const { data: channel } = await supabaseAdmin
        .from('creator_channels')
        .select('id')
        .or(`owner_user_id.eq.${user.id},created_by_user_id.eq.${user.id}`)
        .maybeSingle();

      if (channel?.id) {
        channelId = channel.id;
      } else {
        const { data: artist } = await supabaseAdmin
          .from('artist_profiles')
          .select('id')
          .or(`created_by_user_id.eq.${user.id},primary_contact_user_id.eq.${user.id}`)
          .maybeSingle();
        if (artist?.id) channelId = artist.id;
      }
    }

    if (!channelId) {
      return res.status(404).json({ error: 'Creator channel or artist profile not found.' });
    }

    const overview = await getArtistWalletOverview(channelId);
    res.json(overview);
  } catch (err: any) {
    console.error('getArtistEscrow error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const requestArtistWithdrawal = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user?.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const {
    amount,
    payout_method = 'MTN Mobile Money',
    phone,
    account_number,
    account_name,
    payout_currency = 'RWF',
    country_code = 'RW'
  } = req.body;

  try {
    const { data: channel } = await supabaseAdmin
      .from('creator_channels')
      .select('id, channel_name')
      .or(`owner_user_id.eq.${user.id},created_by_user_id.eq.${user.id}`)
      .maybeSingle();

    if (!channel) {
      return res.status(404).json({ error: 'Creator channel not found.' });
    }

    const { data: account } = await supabaseAdmin
      .from('creator_earning_accounts')
      .select('*')
      .eq('creator_channel_id', channel.id)
      .maybeSingle();

    if (!account) {
      return res.status(400).json({ error: 'Creator earning account not initialized.' });
    }

    const withdrawAmount = Number(amount);
    if (!withdrawAmount || Number.isNaN(withdrawAmount) || withdrawAmount <= 0) {
      return res.status(400).json({ error: 'Please enter a valid withdrawal amount.' });
    }

    const minThreshold = Number(process.env.MIN_WITHDRAWAL_RWF || 5000);
    if (withdrawAmount < minThreshold) {
      return res.status(400).json({ error: `Minimum withdrawal is ${minThreshold.toLocaleString()} ${payout_currency}.` });
    }

    const currentBalance = Number(account.available_balance || 0);
    if (currentBalance < withdrawAmount) {
      return res.status(400).json({
        error: `Insufficient balance. Available: ${currentBalance.toLocaleString()} ${account.currency_code}, requested: ${withdrawAmount.toLocaleString()} ${payout_currency}.`
      });
    }

    const destination = String(phone || account_number || '').trim();
    if (!destination) {
      return res.status(400).json({ error: 'Payout destination phone or account number is required.' });
    }

    const now = new Date().toISOString();

    // Ensure payout method exists
    let { data: payoutMethod } = await supabaseAdmin
      .from('creator_payout_methods')
      .select('id')
      .eq('creator_channel_id', channel.id)
      .eq('masked_account_reference', destination)
      .maybeSingle();

    if (!payoutMethod) {
      const { data: createdPm, error: pmErr } = await supabaseAdmin
        .from('creator_payout_methods')
        .insert({
          id: randomUUID(),
          creator_channel_id: channel.id,
          owner_user_id: user.id,
          method_type: String(payout_method).toLowerCase().includes('bank') ? 'bank_transfer' : 'mobile_money',
          provider_name: payout_method,
          provider_account_reference: destination,
          provider_method_reference: `pm_${randomUUID().slice(0, 12)}`,
          country_code,
          currency_code: payout_currency,
          account_holder_name: account_name || channel.channel_name,
          masked_account_reference: destination,
          method_status: 'active',
          verification_status: 'pending',
          is_default: true,
          metadata: { destination },
          created_at: now,
          updated_at: now
        })
        .select('id')
        .single();
      if (pmErr) throw pmErr;
      payoutMethod = createdPm;
    }

    const refCode = `PT-WD-${randomUUID().slice(0, 8).toUpperCase()}`;
    const withdrawalId = randomUUID();

    const { data: withdrawalRecord, error: wErr } = await supabaseAdmin
      .from('creator_withdrawal_requests')
      .insert({
        id: withdrawalId,
        withdrawal_reference: refCode,
        creator_channel_id: channel.id,
        earning_account_id: account.id,
        payout_method_id: payoutMethod.id,
        requested_by: user.id,
        country_code,
        currency_code: payout_currency,
        requested_amount: withdrawAmount,
        withdrawal_fee: 0,
        net_payout_amount: withdrawAmount,
        withdrawal_status: 'requested',
        idempotency_key: `wd:${withdrawalId}`,
        metadata: {
          payout_method,
          destination,
          account_name: account_name || channel.channel_name
        },
        created_at: now,
        updated_at: now
      })
      .select()
      .single();

    if (wErr) throw wErr;

    const newBalance = Number((currentBalance - withdrawAmount).toFixed(2));
    await supabaseAdmin
      .from('creator_earning_accounts')
      .update({
        available_balance: newBalance,
        pending_balance: Number((Number(account.pending_balance || 0) + withdrawAmount).toFixed(2)),
        updated_at: now
      })
      .eq('id', account.id);

    res.json({
      success: true,
      message: `Withdrawal request for ${withdrawAmount.toLocaleString()} ${payout_currency} submitted for review.`,
      withdrawal: withdrawalRecord,
      new_balance: newBalance
    });
  } catch (err: any) {
    console.error('requestArtistWithdrawal error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const getMasterEscrowOverview = async (_req: Request, res: Response) => {
  try {
    const overview = await getPlatformEscrowOverview();
    res.json(overview);
  } catch (err: any) {
    console.error('getMasterEscrowOverview error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const getMasterEscrowTransactions = async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('financial_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw error;
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const approveEscrowWithdrawal = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;
  try {
    const { data: item, error: fetchErr } = await supabaseAdmin
      .from('creator_withdrawal_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !item) {
      return res.status(404).json({ error: 'Withdrawal not found' });
    }

    if (item.withdrawal_status === 'paid') {
      return res.json({ success: true, withdrawal: item });
    }

    const now = new Date().toISOString();
    const settledRef = `PT-SETTLED-${randomUUID().slice(0, 8).toUpperCase()}`;

    const { data: updated, error: updErr } = await supabaseAdmin
      .from('creator_withdrawal_requests')
      .update({
        withdrawal_status: 'paid',
        reviewed_by: user?.id || null,
        reviewed_at: now,
        approved_at: now,
        paid_at: now,
        metadata: {
          ...(item.metadata || {}),
          transaction_ref: settledRef,
          processed_by: user?.email || null
        },
        updated_at: now
      })
      .eq('id', id)
      .select()
      .single();

    if (updErr) throw updErr;

    const { data: acct } = await supabaseAdmin
      .from('creator_earning_accounts')
      .select('id, pending_balance, settled_total')
      .eq('id', item.earning_account_id)
      .maybeSingle();

    if (acct) {
      await supabaseAdmin
        .from('creator_earning_accounts')
        .update({
          pending_balance: Math.max(0, Number(acct.pending_balance || 0) - Number(item.requested_amount || 0)),
          settled_total: Number(acct.settled_total || 0) + Number(item.requested_amount || 0),
          updated_at: now
        })
        .eq('id', acct.id);
    }

    res.json({
      success: true,
      message: `Withdrawal ${id} marked as paid (${settledRef}).`,
      withdrawal: updated
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const rejectEscrowWithdrawal = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason = 'Verification mismatch' } = req.body;
  const user = (req as any).user;

  try {
    const { data: item, error: fetchErr } = await supabaseAdmin
      .from('creator_withdrawal_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !item) {
      return res.status(404).json({ error: 'Withdrawal not found' });
    }

    if (item.withdrawal_status === 'rejected') {
      return res.json({ success: true, withdrawal: item });
    }
    if (item.withdrawal_status === 'paid') {
      return res.status(409).json({ error: 'Cannot reject a withdrawal that has already been paid.' });
    }

    const now = new Date().toISOString();
    const { data: updated, error: updErr } = await supabaseAdmin
      .from('creator_withdrawal_requests')
      .update({
        withdrawal_status: 'rejected',
        rejection_reason: reason,
        reviewed_by: user?.id || null,
        reviewed_at: now,
        rejected_at: now,
        updated_at: now
      })
      .eq('id', id)
      .select()
      .single();

    if (updErr) throw updErr;

    const { data: acct } = await supabaseAdmin
      .from('creator_earning_accounts')
      .select('id, available_balance, pending_balance')
      .eq('id', item.earning_account_id)
      .maybeSingle();

    if (acct) {
      await supabaseAdmin
        .from('creator_earning_accounts')
        .update({
          available_balance: Number(acct.available_balance || 0) + Number(item.requested_amount || 0),
          pending_balance: Math.max(0, Number(acct.pending_balance || 0) - Number(item.requested_amount || 0)),
          updated_at: now
        })
        .eq('id', acct.id);
    }

    res.json({
      success: true,
      message: `Withdrawal ${id} rejected. Funds returned to creator wallet.`,
      withdrawal: updated
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
