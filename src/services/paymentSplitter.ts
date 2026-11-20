import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../config/supabase';
import { notifyOnPurchaseCompleted } from './notificationService';
import { resolveProviderAccountId } from './paymentService';

interface SplitResult {
  total: number;
  vat: number;
  afterVat: number;
  artistShare: number;
  ownerShare: number;
}

export function calculateSplit(amount: number): SplitResult {
  const num = Number(amount) || 0;
  const vatRate = Number(process.env.VAT_PERCENTAGE || 5) / 100;
  const artistRate = Number(process.env.ARTIST_SHARE_PERCENTAGE || 70) / 100;

  const vat = Number((num * vatRate).toFixed(2));
  const afterVat = Number((num - vat).toFixed(2));
  const artistShare = Number((afterVat * artistRate).toFixed(2));
  const ownerShare = Number((afterVat * (1 - artistRate)).toFixed(2));

  return {
    total: num,
    vat,
    afterVat,
    artistShare,
    ownerShare
  };
}

export async function processPurchase(
  userId: string,
  videoId: string,
  paymentPhone: string,
  amount: number,
  transactionId: string,
  paymentMethod: string
) {
  if (!videoId) throw new Error('Video ID is required');
  if (!userId) throw new Error('User ID is required');
  if (!amount || amount <= 0) throw new Error('Valid purchase amount is required');

  const split = calculateSplit(amount);

  const { data: video, error: vError } = await supabaseAdmin
    .from('videos')
    .select('id, creator_channel_id, artist_profile_id, title, is_free')
    .eq('id', videoId)
    .maybeSingle();

  if (vError || !video) {
    throw new Error('Video record not found in database.');
  }

  const now = new Date().toISOString();
  const intentId = randomUUID();
  const providerAccountId = await resolveProviderAccountId(paymentMethod || 'mtn_momo');

  await supabaseAdmin.from('payment_intents').insert({
    id: intentId,
    provider_account_id: providerAccountId,
    user_id: userId,
    revenue_source: 'premium_content',
    source_record_id: video.id,
    currency_code: 'RWF',
    amount: split.total,
    amount_received: split.total,
    amount_refunded: 0,
    payment_status: 'succeeded',
    requires_customer_action: false,
    provider_payment_reference: transactionId,
    idempotency_key: `purchase:${transactionId}`,
    succeeded_at: now,
    provider_metadata: {
      payment_phone: paymentPhone || null,
      payment_method: paymentMethod,
      vat_amount: split.vat,
      artist_share: split.artistShare,
      owner_share: split.ownerShare
    },
    created_at: now,
    updated_at: now
  });

  const { data: finTx, error: finErr } = await supabaseAdmin
    .from('financial_transactions')
    .insert({
      id: randomUUID(),
      payment_intent_id: intentId,
      user_id: userId,
      creator_channel_id: video.creator_channel_id,
      transaction_type: 'payment',
      revenue_source: 'premium_content',
      source_record_id: video.id,
      currency_code: 'RWF',
      gross_amount: split.total,
      fee_amount: split.vat,
      net_amount: split.afterVat,
      transaction_status: 'succeeded',
      provider_transaction_reference: transactionId,
      description: `Purchase of ${video.title}`,
      processed_at: now,
      created_at: now
    })
    .select()
    .maybeSingle();

  if (finErr) {
    throw new Error(`Failed to record financial transaction: ${finErr.message}`);
  }

  const { data: activeClaim } = await supabaseAdmin
    .from('copyright_claims')
    .select('id, claimant_user_id, claim_status')
    .eq('content_id', video.id)
    .in('claim_status', ['submitted', 'under_review', 'accepted', 'disputed'])
    .maybeSingle();

  const { data: earningAccount } = await supabaseAdmin
    .from('creator_earning_accounts')
    .select('id, available_balance')
    .eq('creator_channel_id', video.creator_channel_id)
    .maybeSingle();

  if (activeClaim && earningAccount) {
    await supabaseAdmin
      .from('creator_earning_transactions')
      .insert({
        id: randomUUID(),
        earning_account_id: earningAccount.id,
        financial_transaction_id: finTx?.id || null,
        revenue_source: 'premium_content',
        earning_status: 'pending',
        currency_code: 'RWF',
        gross_amount: split.total,
        platform_fee: Number((split.vat + split.ownerShare).toFixed(2)),
        creator_amount: split.artistShare,
        source_record_id: video.id,
        description: `Held in escrow pending copyright claim ${activeClaim.id}`,
        metadata: { copyright_claim_id: activeClaim.id },
        created_at: now
      });
  } else if (!activeClaim) {
    await supabaseAdmin.from('premium_content_access_grants').insert({
      id: randomUUID(),
      creator_channel_id: video.creator_channel_id,
      user_id: userId,
      content_type: 'video',
      content_id: video.id,
      granted_at: now,
      grant_reason: 'purchase',
      grant_metadata: {
        transaction_id: transactionId,
        payment_method: paymentMethod
      }
    });

    if (earningAccount) {
      await supabaseAdmin.from('creator_earning_transactions').insert({
        id: randomUUID(),
        earning_account_id: earningAccount.id,
        financial_transaction_id: finTx?.id || null,
        revenue_source: 'premium_content',
        earning_status: 'available',
        currency_code: 'RWF',
        gross_amount: split.total,
        platform_fee: Number((split.vat + split.ownerShare).toFixed(2)),
        creator_amount: split.artistShare,
        source_record_id: video.id,
        available_at: now,
        description: `Creator 70% share for ${video.title}`,
        metadata: { transaction_id: transactionId },
        created_at: now
      });

      await supabaseAdmin
        .from('creator_earning_accounts')
        .update({
          available_balance: Number((Number(earningAccount.available_balance || 0) + split.artistShare).toFixed(2)),
          last_transaction_at: now,
          updated_at: now
        })
        .eq('id', earningAccount.id);
    }
  }

  await notifyOnPurchaseCompleted({
    purchaseId: finTx?.id || intentId,
    userId,
    artistId: video.artist_profile_id || video.creator_channel_id,
    videoTitle: video.title,
    videoId: video.id,
    amount: split.total,
    currency: 'RWF',
    artistShare: split.artistShare
  });

  return {
    id: finTx?.id || intentId,
    user_id: userId,
    video_id: video.id,
    payment_phone: paymentPhone || null,
    amount_paid: split.total,
    vat_amount: split.vat,
    after_vat: split.afterVat,
    artist_share: split.artistShare,
    owner_share: split.ownerShare,
    transaction_id: transactionId,
    payment_method: paymentMethod,
    created_at: now
  };
}
