import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../config/supabase';
import { calculateGlobalQuote } from './currencyService';
import { hasMtnCredentials } from './mtnService';
import { hasAirtelCredentials } from './airtelService';
import { hasStripeCredentials } from './stripeService';
import { resolveProviderAccountId } from './paymentService';

function isGatewayConfigured(gateway: string): boolean {
  const g = (gateway || '').toLowerCase();
  if (g.includes('stripe') || g.includes('card')) return hasStripeCredentials();
  if (g.includes('airtel')) return hasAirtelCredentials();
  if (g.includes('mtn')) return hasMtnCredentials();
  return false;
}

/**
 * Process real purchase via configured payment provider into PostgreSQL escrow/ledger tables.
 */
export async function processEscrowPurchase(params: {
  userId: string;
  videoId: string;
  countryCode?: string;
  gateway?: string;
  paymentPhone?: string;
  paymentAccount?: string;
  amount?: number;
  currency?: string;
}) {
  const {
    userId,
    videoId,
    countryCode = 'RW',
    gateway = 'MTN MoMo',
    paymentPhone = '',
    paymentAccount = '',
    amount,
    currency
  } = params;

  if (!isGatewayConfigured(gateway)) {
    const err: any = new Error(`${gateway} payment gateway credentials are not configured.`);
    err.statusCode = 503;
    err.provider_configured = false;
    throw err;
  }

  const { data: video, error: vErr } = await supabaseAdmin
    .from('videos')
    .select('id, title, creator_channel_id, artist_profile_id, metadata, is_free')
    .eq('id', videoId)
    .maybeSingle();

  if (vErr || !video) {
    throw new Error('Video not found in database.');
  }

  const { data: channel } = await supabaseAdmin
    .from('creator_channels')
    .select('id, channel_name')
    .eq('id', video.creator_channel_id)
    .maybeSingle();

  const meta = (video.metadata && typeof video.metadata === 'object' ? video.metadata : {}) as Record<string, any>;
  const basePriceRwf = Number(meta.price_rwf) || Number(amount) || 0;
  if (basePriceRwf <= 0 && !video.is_free) {
    throw new Error('Video price is not configured.');
  }

  const quote = calculateGlobalQuote(basePriceRwf, countryCode);
  const paidCurrency = currency || quote.target_currency;
  const paidAmount = Number(amount) || quote.converted_amount;
  const now = new Date().toISOString();
  const transactionRef = `PT-ESCROW-${countryCode.toUpperCase()}-${randomUUID().slice(0, 8).toUpperCase()}`;

  const intentId = randomUUID();
  const providerAccountId = await resolveProviderAccountId(gateway || 'mtn_momo');
  await supabaseAdmin.from('payment_intents').insert({
    id: intentId,
    provider_account_id: providerAccountId,
    user_id: userId,
    revenue_source: 'premium_content',
    source_record_id: video.id,
    currency_code: paidCurrency,
    amount: paidAmount,
    amount_received: 0,
    amount_refunded: 0,
    payment_status: 'pending',
    requires_customer_action: false,
    provider_payment_reference: transactionRef,
    idempotency_key: `escrow:${transactionRef}`,
    provider_metadata: {
      video_id: video.id,
      creator_channel_id: video.creator_channel_id,
      payment_gateway: gateway,
      country_code: countryCode.toUpperCase(),
      payment_phone: paymentPhone || paymentAccount || null,
      vat_amount_rwf: quote.vat_amount_rwf,
      artist_share_rwf: quote.artist_share_rwf,
      owner_share_rwf: quote.platform_share_rwf
    },
    created_at: now,
    updated_at: now
  });

  return {
    success: true,
    status: 'pending',
    provider_configured: true,
    transactionRef,
    quote,
    paymentIntentId: intentId,
    video: {
      id: video.id,
      title: video.title,
      artist_name: channel?.channel_name || ''
    }
  };
}

/**
 * Get Artist Escrow & Available Wallet overview from live PostgreSQL tables.
 */
export async function getArtistWalletOverview(creatorOrArtistId: string) {
  let channelId = creatorOrArtistId;
  let channelName = '';

  const { data: channel } = await supabaseAdmin
    .from('creator_channels')
    .select('id, channel_name')
    .eq('id', creatorOrArtistId)
    .maybeSingle();

  if (channel) {
    channelId = channel.id;
    channelName = channel.channel_name;
  } else {
    const { data: artist } = await supabaseAdmin
      .from('artist_profiles')
      .select('id, artist_name, primary_contact_user_id, created_by_user_id')
      .eq('id', creatorOrArtistId)
      .maybeSingle();
    if (artist) {
      channelName = artist.artist_name;
      const ownerId = artist.primary_contact_user_id || artist.created_by_user_id;
      if (ownerId) {
        const { data: owned } = await supabaseAdmin
          .from('creator_channels')
          .select('id')
          .eq('owner_user_id', ownerId)
          .maybeSingle();
        if (owned?.id) channelId = owned.id;
      }
    }
  }

  const { data: account } = await supabaseAdmin
    .from('creator_earning_accounts')
    .select('*')
    .eq('creator_channel_id', channelId)
    .maybeSingle();

  const { data: payoutMethod } = await supabaseAdmin
    .from('creator_payout_methods')
    .select('provider_name, masked_account_reference')
    .eq('creator_channel_id', channelId)
    .eq('is_default', true)
    .maybeSingle();

  const { data: withdrawals } = await supabaseAdmin
    .from('creator_withdrawal_requests')
    .select('*')
    .eq('creator_channel_id', channelId)
    .order('created_at', { ascending: false })
    .limit(10);

  let recentTransactions: any[] = [];
  let totalEarned = Number(account?.available_balance || 0) + Number(account?.pending_balance || 0) + Number(account?.settled_total || 0);
  if (account?.id) {
    const [{ data: txs }, { data: allEarnedTxs }] = await Promise.all([
      supabaseAdmin
        .from('creator_earning_transactions')
        .select('*')
        .eq('earning_account_id', account.id)
        .order('created_at', { ascending: false })
        .limit(10),
      supabaseAdmin
        .from('creator_earning_transactions')
        .select('creator_amount, earning_status')
        .eq('earning_account_id', account.id)
    ]);
    recentTransactions = txs || [];
    const ledgerSum = (allEarnedTxs || [])
      .filter((tx: any) => !['reversed', 'cancelled', 'refunded'].includes(String(tx.earning_status || '')))
      .reduce((sum: number, tx: any) => sum + (Number(tx.creator_amount) || 0), 0);
    if (ledgerSum > 0) {
      totalEarned = Math.max(totalEarned, ledgerSum);
    }
  }

  return {
    artist_id: channelId,
    artist_name: channelName,
    currency: account?.currency_code || 'RWF',
    available_balance_rwf: Number(account?.available_balance || 0),
    escrow_balance_rwf: Number(account?.pending_balance || 0),
    total_earned_rwf: totalEarned,
    total_withdrawn_rwf: Number(account?.settled_total || 0),
    payout_method: payoutMethod?.provider_name || null,
    payout_account: payoutMethod?.masked_account_reference || '',
    recent_escrow_transactions: recentTransactions,
    withdrawals: withdrawals || []
  };
}

/**
 * Get Master Admin Global Escrow & Settlement Overview from PostgreSQL ledger tables.
 */
export async function getPlatformEscrowOverview() {
  const { data: txRows } = await supabaseAdmin
    .from('financial_transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  const { data: withdrawalRows } = await supabaseAdmin
    .from('creator_withdrawal_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  const txs = txRows || [];
  const withdrawals = withdrawalRows || [];

  const succeeded = txs.filter((t: any) => t.transaction_status === 'succeeded');
  const pending = txs.filter((t: any) => t.transaction_status === 'pending');

  const totalHeldInEscrow = pending.reduce((sum: number, t: any) => sum + (Number(t.gross_amount) || 0), 0);
  const totalGrossVolume = succeeded.reduce((sum: number, t: any) => sum + (Number(t.gross_amount) || 0), 0);
  const totalVatCollected = succeeded.reduce((sum: number, t: any) => sum + (Number(t.fee_amount) || 0), 0);
  const totalNet = succeeded.reduce((sum: number, t: any) => sum + (Number(t.net_amount) || 0), 0);
  const totalArtistDisbursed = Number((totalNet * 0.7).toFixed(2));
  const totalPlatformRevenue = Number((totalNet * 0.3).toFixed(2));

  const pendingWithdrawals = withdrawals.filter((w: any) =>
    ['requested', 'under_review', 'queued', 'processing'].includes(w.withdrawal_status)
  );
  const pendingWithdrawalsAmount = pendingWithdrawals.reduce(
    (sum: number, w: any) => sum + (Number(w.requested_amount) || 0),
    0
  );

  return {
    currency: 'RWF',
    total_held_in_escrow: totalHeldInEscrow,
    total_gross_volume: totalGrossVolume,
    total_vat_collected: totalVatCollected,
    total_platform_revenue: totalPlatformRevenue,
    total_artist_disbursed: totalArtistDisbursed,
    pending_withdrawals_count: pendingWithdrawals.length,
    pending_withdrawals_amount: pendingWithdrawalsAmount,
    volume_by_country: {},
    volume_by_gateway: {},
    recent_transactions: txs.slice(0, 20),
    recent_withdrawals: withdrawals.slice(0, 20)
  };
}
