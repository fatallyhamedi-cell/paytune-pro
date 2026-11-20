import { Request, Response } from 'express';
import crypto from 'crypto';
import { rawSupabaseAdmin, supabaseAdmin, isSupabaseConfigured } from '../config/supabase';
import { notifyWithdrawalRequested } from '../services/notificationService';

const db = () => rawSupabaseAdmin || supabaseAdmin;

async function resolveCreatorContext(req: Request, customArtistId?: string) {
  const user = (req as any).user;
  const client = db();

  let artist: any = null;
  if (customArtistId) {
    const { data } = await client.from('artist_profiles').select('*').eq('id', customArtistId).maybeSingle();
    artist = data;
  }
  if (!artist && user?.id) {
    const { data } = await client
      .from('artist_profiles')
      .select('*')
      .or(`created_by_user_id.eq.${user.id},primary_contact_user_id.eq.${user.id}`)
      .limit(1)
      .maybeSingle();
    artist = data;
  }

  let channel: any = null;
  if (user?.id) {
    const { data } = await client
      .from('creator_channels')
      .select('*')
      .or(`owner_user_id.eq.${user.id},created_by_user_id.eq.${user.id}`)
      .limit(1)
      .maybeSingle();
    channel = data;
  }
  if (!channel && customArtistId) {
    const { data } = await client.from('creator_channels').select('*').eq('id', customArtistId).maybeSingle();
    channel = data;
  }

  return { artist, channel };
}

/**
 * POST /api/artist/withdraw
 * Request payout via creator_withdrawal_requests in PostgreSQL.
 */
export const requestWithdrawal = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const {
    amount,
    payment_method = 'MTN Mobile Money',
    phone,
    account_number,
    account_name,
    artistId: customArtistId,
    country_code = 'RW',
    currency_code = 'RWF',
  } = req.body || {};

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Database service unavailable.' });
  }

  try {
    const client = db();
    const { artist, channel } = await resolveCreatorContext(req, customArtistId);

    if (!channel) {
      return res.status(404).json({ error: 'Creator channel not found for this account.' });
    }

    const withdrawAmount = Number(amount);
    if (!withdrawAmount || Number.isNaN(withdrawAmount) || withdrawAmount <= 0) {
      return res.status(400).json({ error: 'Please enter a valid withdrawal amount.' });
    }

    const minThreshold = Number(process.env.MIN_WITHDRAWAL_RWF || 5000);
    if (withdrawAmount < minThreshold) {
      return res.status(400).json({
        error: `Minimum withdrawal threshold is ${minThreshold.toLocaleString()} ${currency_code}.`,
      });
    }

    const { data: earningAccount } = await client
      .from('creator_earning_accounts')
      .select('*')
      .eq('creator_channel_id', channel.id)
      .maybeSingle();

    if (!earningAccount) {
      return res.status(400).json({
        error: 'No monetization earning account found for this creator channel.',
      });
    }

    const availableBalance = Number(earningAccount.available_balance || 0);
    if (availableBalance < withdrawAmount) {
      return res.status(400).json({
        error: `Insufficient available balance (${availableBalance.toLocaleString()} ${earningAccount.currency_code}).`,
      });
    }

    const payoutDestination = String(phone || account_number || '').trim();
    if (!payoutDestination) {
      return res.status(400).json({ error: 'Payout destination phone number or account number is required.' });
    }

    let { data: payoutMethod } = await client
      .from('creator_payout_methods')
      .select('*')
      .eq('creator_channel_id', channel.id)
      .eq('method_status', 'active')
      .order('is_default', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!payoutMethod) {
      const masked = payoutDestination.length > 4
        ? `***${payoutDestination.slice(-4)}`
        : payoutDestination;
      const nowIso = new Date().toISOString();

      const { data: createdPm, error: pmErr } = await client
        .from('creator_payout_methods')
        .insert({
          creator_channel_id: channel.id,
          owner_user_id: user.id,
          method_type: String(payment_method).toLowerCase().includes('bank') ? 'bank_transfer' : 'mobile_money',
          provider_name: payment_method,
          provider_account_reference: crypto.createHash('sha256').update(payoutDestination).digest('hex').slice(0, 32),
          provider_method_reference: `pm_${crypto.randomBytes(6).toString('hex')}`,
          country_code: String(country_code).toUpperCase(),
          currency_code: earningAccount.currency_code || currency_code,
          account_holder_name: account_name || artist?.artist_name || channel.channel_name,
          masked_account_reference: masked,
          method_status: 'active',
          verification_status: 'pending',
          is_default: true,
          metadata: { destination: payoutDestination },
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select('*')
        .single();

      if (pmErr) throw pmErr;
      payoutMethod = createdPm;
    }

    const referenceCode = `PAYTUNE-WD-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    const { data: withdrawal, error: wdErr } = await client
      .from('creator_withdrawal_requests')
      .insert({
        withdrawal_reference: referenceCode,
        creator_channel_id: channel.id,
        earning_account_id: earningAccount.id,
        payout_method_id: payoutMethod.id,
        requested_by: user.id,
        country_code: String(country_code).toUpperCase(),
        currency_code: earningAccount.currency_code || currency_code,
        requested_amount: withdrawAmount,
        withdrawal_fee: 0,
        net_payout_amount: withdrawAmount,
        withdrawal_status: 'requested',
        metadata: {
          payment_method,
          account_name: account_name || artist?.artist_name || channel.channel_name,
          masked_account_reference: payoutMethod.masked_account_reference,
        },
      })
      .select('*')
      .single();

    if (wdErr) throw wdErr;

    const newAvailable = Math.max(0, availableBalance - withdrawAmount);
    const newPending = Number(earningAccount.pending_balance || 0) + withdrawAmount;
    await client
      .from('creator_earning_accounts')
      .update({
        available_balance: newAvailable,
        pending_balance: newPending,
        last_transaction_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', earningAccount.id);

    try {
      await notifyWithdrawalRequested({
        withdrawalId: withdrawal.id,
        artistId: artist?.id || channel.id,
        artistName: artist?.artist_name || channel.channel_name,
        amount: withdrawAmount,
        phone: payoutMethod.masked_account_reference,
        provider: payment_method,
      });
    } catch {
      // Notification dispatch failure must not abort recorded withdrawal
    }

    return res.json({
      success: true,
      message: `Withdrawal request ${referenceCode} for ${withdrawAmount.toLocaleString()} ${earningAccount.currency_code} submitted.`,
      withdrawal,
      new_balance: newAvailable,
    });
  } catch (err: any) {
    console.error('requestWithdrawal error:', err);
    return res.status(500).json({ error: err.message || 'An error occurred while processing withdrawal.' });
  }
};

/**
 * GET /api/artist/withdrawals
 */
export const getArtistWithdrawals = async (req: Request, res: Response) => {
  try {
    const client = db();
    const { channel } = await resolveCreatorContext(req);
    if (!channel) {
      return res.json([]);
    }

    const { data, error } = await client
      .from('creator_withdrawal_requests')
      .select('*')
      .eq('creator_channel_id', channel.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    const normalized = (data || []).map((w: any) => {
      const meta = w.metadata && typeof w.metadata === 'object' ? w.metadata : {};
      return {
        ...w,
        amount: Number(w.requested_amount || 0),
        reference_code: w.withdrawal_reference,
        payment_method: meta.payment_method || meta.payout_method || 'MTN Mobile Money',
        phone: meta.masked_account_reference || meta.destination || '',
        status: w.withdrawal_status,
      };
    });
    return res.json(normalized);
  } catch (err: any) {
    console.error('getArtistWithdrawals error:', err);
    return res.status(500).json({ error: err.message || 'Failed to load withdrawals' });
  }
};
