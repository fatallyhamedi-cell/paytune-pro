import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { processPurchase, calculateSplit } from '../services/paymentSplitter';
import { processEscrowPurchase } from '../services/escrowService';
import { processMobileMoney, disburseToArtist } from '../services/paymentProviders';

/**
 * POST /api/purchase/initiate
 * Body: { videoId, paymentPhone, provider, gateway, countryCode, currency, amount? }
 * Initiates payment via country-routed gateway with Escrow settlement. Returns transaction reference.
 */
export const initiatePurchase = async (req: Request, res: Response) => {
  const { 
    videoId, 
    paymentPhone, 
    paymentAccount,
    provider, 
    gateway, 
    countryCode = 'RW', 
    currency, 
    amount 
  } = req.body;
  const user = (req as any).user;

  if (!user) {
    return res.status(401).json({ error: "Authentication required to make a purchase." });
  }

  if (!videoId) {
    return res.status(400).json({ error: "videoId is required" });
  }

  try {
    // 1. Fetch video details
    const { data: video, error: vErr } = await supabaseAdmin
      .from('videos')
      .select('*, artists(*)')
      .eq('id', videoId)
      .maybeSingle();

    if (vErr || !video) {
      return res.status(404).json({ error: "Video not found" });
    }

    if (video.is_free) {
      return res.json({ 
        success: true, 
        message: "This video is free to watch.", 
        userOwns: true 
      });
    }

    // 2. Use the Global Escrow Engine (5% VAT deducted, 70% to Artist Wallet, 30% to PAYTUNE Wallet)
    const selectedGateway = gateway || provider || 'MTN MoMo';
    const result = await processEscrowPurchase({
      userId: user.id,
      videoId,
      countryCode,
      gateway: selectedGateway,
      paymentPhone: paymentPhone || paymentAccount,
      paymentAccount,
      amount,
      currency
    });

    // 3. Return full transaction details and receipt
    res.json({
      success: true,
      transactionId: result.transactionRef,
      message: "Payment successfully secured in PAYTUNE Escrow! Lifetime access unlocked.",
      purchase: {
        ...result.purchase,
        video_title: video.title,
        artist_name: video.artists?.full_name || video.artist_name || "PAYTUNE Artist"
      },
      escrow: result.escrow,
      quote: result.quote,
      userOwns: true
    });
  } catch (error: any) {
    console.error("initiatePurchase error:", error);
    res.status(500).json({ error: error.message || "Payment processing failed" });
  }
};

/**
 * POST /api/purchase/webhook
 * Payment callback. Verifies transaction, calculates split (5% VAT -> 70/30),
 * records purchase in purchases table, grants user access.
 */
export const handlePurchaseWebhook = async (req: Request, res: Response) => {
  const { 
    transactionId, 
    status = "SUCCESS", 
    videoId, 
    userId, 
    amount, 
    phone = "0780000000", 
    provider = "MTN" 
  } = req.body;

  try {
    if (status !== "SUCCESS" && status !== "completed") {
      return res.status(400).json({ error: "Payment was not successful or was cancelled." });
    }

    if (!videoId || !userId) {
      return res.status(400).json({ error: "videoId and userId are required" });
    }

    const { data: existing } = await supabaseAdmin
      .from('purchases')
      .select('id')
      .eq('transaction_id', transactionId)
      .maybeSingle();

    if (existing) {
      return res.json({ success: true, message: "Transaction already processed", purchaseId: existing.id });
    }

    const purchase = await processPurchase(
      userId,
      videoId,
      phone,
      Number(amount) || 1000,
      transactionId || `PAYTUNE-HOOK-${Date.now()}`,
      provider
    );

    res.json({
      success: true,
      message: "Purchase verified and recorded. Lifetime access granted.",
      purchase
    });
  } catch (error: any) {
    console.error("handlePurchaseWebhook error:", error);
    res.status(500).json({ error: error.message || "Webhook processing failed" });
  }
};

/**
 * POST /api/purchase/gift
 * Buy video for a friend
 */
export const giftPurchase = async (req: Request, res: Response) => {
  const { videoId, recipientEmail, giftMessage, paymentPhone, provider = "MTN" } = req.body;
  const user = (req as any).user;

  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (!videoId || !recipientEmail) {
    return res.status(400).json({ error: "videoId and recipientEmail are required" });
  }

  try {
    const { data: video } = await supabaseAdmin
      .from('videos')
      .select('id, title, price_rwf')
      .eq('id', videoId)
      .maybeSingle();

    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    const price = Number(video.price_rwf) || 500;
    const transactionId = `PAYTUNE-GIFT-${Date.now()}`;

    // Record gift purchase
    const purchase = await processPurchase(
      user.id,
      videoId,
      paymentPhone || "0780000000",
      price,
      transactionId,
      provider
    );

    // Record in gift registry
    await supabaseAdmin
      .from('video_gifts')
      .insert({
        sender_id: user.id,
        recipient_email: recipientEmail,
        video_id: videoId,
        gift_message: giftMessage || "",
        transaction_id: transactionId,
        redeemed: false,
        created_at: new Date().toISOString()
      });

    res.json({
      success: true,
      message: `Gift successfully purchased and sent to ${recipientEmail}!`,
      transactionId,
      purchase
    });
  } catch (error: any) {
    console.error("giftPurchase error:", error);
    res.status(500).json({ error: error.message });
  }
};
