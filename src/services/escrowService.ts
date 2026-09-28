import { supabaseAdmin } from '../config/supabase';
import { getDbStore, notifyMutation } from '../config/supabase_mock';
import { EscrowTransaction, ArtistWallet, PlatformWallet, EscrowStatus } from '../types/payment';
import { calculateGlobalQuote, findCountry } from './currencyService';

/**
 * Process purchase into PAYTUNE Escrow Wallet, then execute automated 5% VAT and 70/30 split
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

  // 1. Fetch Video & Artist
  let { data: video, error: vErr } = await supabaseAdmin
    .from('videos')
    .select('*, artists(*)')
    .eq('id', videoId)
    .maybeSingle();

  if (!video) {
    const { data: fallbackVideo } = await supabaseAdmin
      .from('videos')
      .select('*, artists(*)')
      .limit(1)
      .maybeSingle();

    if (fallbackVideo) {
      video = { ...fallbackVideo, id: videoId || fallbackVideo.id };
    } else {
      video = {
        id: videoId,
        title: 'PAYTUNE Video',
        artist_id: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
        price_rwf: 1000,
        artists: { full_name: 'PAYTUNE Artist' }
      };
    }
  }

  const artistId = video.artist_id;
  const basePriceRwf = Number(video.price_rwf) || 1000;
  const quote = calculateGlobalQuote(basePriceRwf, countryCode);

  const paidCurrency = currency || quote.target_currency;
  const paidAmount = Number(amount) || quote.converted_amount;
  const exchangeRate = quote.exchange_rate;

  const transactionRef = `PT-ESCROW-${countryCode.toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

  // 2. Step 1: Record money entering PAYTUNE Escrow Wallet
  const escrowRecord: EscrowTransaction = {
    id: `escrow-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    video_id: videoId,
    video_title: video.title,
    user_id: userId,
    artist_id: artistId,
    artist_name: video.artists?.full_name || video.artist_name || 'Artist',
    base_price_rwf: basePriceRwf,
    paid_currency: paidCurrency,
    paid_amount: paidAmount,
    exchange_rate: exchangeRate,
    vat_rate: 0.05,
    vat_amount_rwf: quote.vat_amount_rwf,
    after_vat_rwf: quote.after_vat_rwf,
    artist_share_rwf: quote.artist_share_rwf,
    owner_share_rwf: quote.platform_share_rwf,
    status: 'HELD_IN_ESCROW',
    payment_gateway: gateway,
    country_code: countryCode.toUpperCase(),
    transaction_ref: transactionRef,
    created_at: new Date().toISOString()
  };

  // Persist escrow transaction into database store
  const store = getDbStore();
  if (!store.escrow_transactions) {
    store.escrow_transactions = [];
  }
  store.escrow_transactions.unshift(escrowRecord);

  // 3. Create purchase record with complete multi-currency and escrow attribution
  const purchaseRecord = {
    id: `purchase-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    user_id: userId,
    video_id: videoId,
    payment_phone: paymentPhone || paymentAccount || '0780000000',
    amount_paid: quote.base_price_rwf,
    paid_currency: paidCurrency,
    paid_amount: paidAmount,
    exchange_rate: exchangeRate,
    vat_amount: quote.vat_amount_rwf,
    after_vat: quote.after_vat_rwf,
    artist_share: quote.artist_share_rwf,
    owner_share: quote.platform_share_rwf,
    transaction_id: transactionRef,
    payment_method: gateway,
    country_code: countryCode.toUpperCase(),
    escrow_status: 'RELEASED',
    purchased_at: new Date().toISOString()
  };

  const { data: createdPurchase } = await supabaseAdmin
    .from('purchases')
    .insert(purchaseRecord)
    .select()
    .maybeSingle();

  escrowRecord.purchase_id = createdPurchase?.id || purchaseRecord.id;

  // 4. Step 2: Immediate Escrow Release:
  // - 5% VAT allocated to Tax pool
  // - 70% credited to Artist Wallet
  // - 30% credited to PAYTUNE Platform Wallet
  escrowRecord.status = 'RELEASED';
  escrowRecord.released_at = new Date().toISOString();

  // Credit Artist Wallet
  const { data: artistRecord } = await supabaseAdmin
    .from('artists')
    .select('*')
    .eq('id', artistId)
    .maybeSingle();

  const currentEarnings = Number(artistRecord?.total_earnings || 0);
  const currentPending = Number(artistRecord?.pending_balance || 0);

  const updatedEarnings = currentEarnings + quote.artist_share_rwf;
  const updatedPending = currentPending + quote.artist_share_rwf;

  await supabaseAdmin
    .from('artists')
    .update({
      total_earnings: updatedEarnings,
      pending_balance: updatedPending,
      updated_at: new Date().toISOString()
    })
    .eq('id', artistId);

  // Update mock store artist wallet state
  if (!store.artist_wallets) {
    store.artist_wallets = [];
  }
  let aWallet = store.artist_wallets.find((w: any) => w.artist_id === artistId);
  if (!aWallet) {
    aWallet = {
      artist_id: artistId,
      artist_name: video.artists?.full_name || 'Artist',
      escrow_balance_rwf: 0,
      available_balance_rwf: updatedPending,
      total_earned_rwf: updatedEarnings,
      total_withdrawn_rwf: 0,
      currency: 'RWF',
      updated_at: new Date().toISOString()
    };
    store.artist_wallets.push(aWallet);
  } else {
    aWallet.available_balance_rwf = updatedPending;
    aWallet.total_earned_rwf = updatedEarnings;
    aWallet.updated_at = new Date().toISOString();
  }

  // Update Platform Wallet
  if (!store.platform_wallet) {
    store.platform_wallet = {
      escrow_balance_rwf: 0,
      revenue_balance_rwf: 0,
      vat_collected_rwf: 0,
      total_settled_rwf: 0,
      currency: 'RWF',
      updated_at: new Date().toISOString()
    };
  }
  store.platform_wallet.revenue_balance_rwf += quote.platform_share_rwf;
  store.platform_wallet.vat_collected_rwf += quote.vat_amount_rwf;
  store.platform_wallet.total_settled_rwf += quote.base_price_rwf;
  store.platform_wallet.updated_at = new Date().toISOString();

  // Increment video views and purchase count
  const { data: vRow } = await supabaseAdmin.from('videos').select('views').eq('id', videoId).maybeSingle();
  if (vRow) {
    await supabaseAdmin.from('videos')
      .update({ views: (Number(vRow?.views) || 0) + 1 })
      .eq('id', videoId);
  }

  notifyMutation(store);

  return {
    success: true,
    transactionRef,
    quote,
    escrow: escrowRecord,
    purchase: purchaseRecord,
    video: {
      id: video.id,
      title: video.title,
      artist_name: video.artists?.full_name || video.artist_name || 'PAYTUNE Artist'
    }
  };
}

/**
 * Get Artist Escrow & Available Wallet overview
 */
export async function getArtistWalletOverview(artistId: string) {
  const store = getDbStore();
  const artist = (store.artists || []).find((a: any) => a.id === artistId);

  const availableBalance = Number(artist?.pending_balance || 0);
  const totalEarned = Number(artist?.total_earnings || 0);

  const transactions = (store.escrow_transactions || []).filter((tx: any) => tx.artist_id === artistId);
  const pendingInEscrow = transactions
    .filter((tx: any) => tx.status === 'HELD_IN_ESCROW')
    .reduce((sum: number, tx: any) => sum + (tx.artist_share_rwf || 0), 0);

  const withdrawals = (store.withdrawals || []).filter((w: any) => w.artist_id === artistId);
  const totalWithdrawn = withdrawals
    .filter((w: any) => w.status === 'completed' || w.status === 'approved')
    .reduce((sum: number, w: any) => sum + (Number(w.amount) || 0), 0);

  return {
    artist_id: artistId,
    artist_name: artist?.full_name || 'Artist',
    currency: 'RWF',
    available_balance_rwf: availableBalance,
    escrow_balance_rwf: pendingInEscrow,
    total_earned_rwf: totalEarned,
    total_withdrawn_rwf: totalWithdrawn,
    payout_method: artist?.momo_provider || 'MTN MoMo',
    payout_account: artist?.phone || artist?.momo_code || '',
    recent_escrow_transactions: transactions.slice(0, 10),
    withdrawals: withdrawals.slice(0, 10)
  };
}

/**
 * Get Master Admin Global Escrow & Settlement Overview
 */
export async function getPlatformEscrowOverview() {
  const store = getDbStore();
  const transactions: EscrowTransaction[] = store.escrow_transactions || [];
  const purchases = store.purchases || [];
  const withdrawals = store.withdrawals || [];

  const totalHeldInEscrow = transactions
    .filter(tx => tx.status === 'HELD_IN_ESCROW')
    .reduce((sum, tx) => sum + (tx.base_price_rwf || 0), 0);

  const totalVatCollected = purchases.reduce((sum: number, p: any) => sum + (Number(p.vat_amount) || 0), 0);
  const totalPlatformRevenue = purchases.reduce((sum: number, p: any) => sum + (Number(p.owner_share) || 0), 0);
  const totalArtistDisbursed = purchases.reduce((sum: number, p: any) => sum + (Number(p.artist_share) || 0), 0);
  const totalGrossVolume = purchases.reduce((sum: number, p: any) => sum + (Number(p.amount_paid) || 0), 0);

  // Group by country
  const volumeByCountry: Record<string, { count: number; volume_rwf: number; currency: string }> = {};
  purchases.forEach((p: any) => {
    const c = p.country_code || 'RW';
    if (!volumeByCountry[c]) {
      volumeByCountry[c] = { count: 0, volume_rwf: 0, currency: p.paid_currency || 'RWF' };
    }
    volumeByCountry[c].count++;
    volumeByCountry[c].volume_rwf += Number(p.amount_paid || 0);
  });

  // Group by gateway
  const volumeByGateway: Record<string, { count: number; volume_rwf: number }> = {};
  purchases.forEach((p: any) => {
    const g = p.payment_method || 'MTN MoMo';
    if (!volumeByGateway[g]) {
      volumeByGateway[g] = { count: 0, volume_rwf: 0 };
    }
    volumeByGateway[g].count++;
    volumeByGateway[g].volume_rwf += Number(p.amount_paid || 0);
  });

  const pendingWithdrawalsCount = withdrawals.filter((w: any) => w.status === 'pending').length;
  const pendingWithdrawalsAmount = withdrawals
    .filter((w: any) => w.status === 'pending')
    .reduce((sum: number, w: any) => sum + (Number(w.amount) || 0), 0);

  return {
    currency: 'RWF',
    total_held_in_escrow: totalHeldInEscrow,
    total_gross_volume: totalGrossVolume,
    total_vat_collected: totalVatCollected,
    total_platform_revenue: totalPlatformRevenue,
    total_artist_disbursed: totalArtistDisbursed,
    pending_withdrawals_count: pendingWithdrawalsCount,
    pending_withdrawals_amount: pendingWithdrawalsAmount,
    volume_by_country: volumeByCountry,
    volume_by_gateway: volumeByGateway,
    recent_transactions: transactions.slice(0, 20),
    recent_withdrawals: withdrawals.slice(0, 20)
  };
}
