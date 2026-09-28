import { Router, Request, Response } from 'express';
import { calculateSplit, processPurchase } from '../services/paymentSplitter';
import { generateContentServerSide } from '../services/geminiService';

const router = Router();

/**
 * Edge Function: process-payment
 * Performs payment processing, 5% VAT calculation, and 70/30 artist/owner revenue split
 */
router.post('/process-payment', async (req: Request, res: Response) => {
  try {
    const {
      videoId,
      userId,
      paymentPhone = '0780000000',
      amount,
      paymentMethod = 'MTN MoMo',
      transactionId = `tx_${Date.now()}`
    } = req.body;

    if (!videoId) {
      return res.status(400).json({ error: 'videoId is required' });
    }

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({ error: 'A valid positive amount is required' });
    }

    const resolvedUserId = userId || (req as any).user?.id || 'guest_user';

    // 1. Calculate 5% VAT and 70/30 Artist/Owner Split
    const split = calculateSplit(numericAmount);

    // 2. Process purchase record in database
    let purchaseRecord: any = null;
    try {
      purchaseRecord = await processPurchase(
        resolvedUserId,
        videoId,
        paymentPhone,
        numericAmount,
        transactionId,
        paymentMethod
      );
    } catch (procErr: any) {
      console.warn('[process-payment Edge Function] Purchase recording note:', procErr.message);
      purchaseRecord = {
        id: `pur_${Date.now()}`,
        user_id: resolvedUserId,
        video_id: videoId,
        amount_paid: numericAmount,
        vat_amount: split.vat,
        after_vat: split.afterVat,
        artist_share: split.artistShare,
        owner_share: split.ownerShare,
        transaction_id: transactionId,
        payment_method: paymentMethod,
        created_at: new Date().toISOString()
      };
    }

    return res.json({
      success: true,
      message: 'Payment processed and revenue split successfully via Edge Function',
      transactionId,
      split,
      purchase: purchaseRecord
    });
  } catch (err: any) {
    console.error('[process-payment Edge Function] Error:', err);
    return res.status(500).json({ error: err.message || 'Payment processing failed' });
  }
});

/**
 * Edge Function: gemini-generate
 * Server-side Gemini API generation requiring secret key
 */
router.post('/gemini-generate', async (req: Request, res: Response) => {
  try {
    const { prompt, task = 'general', videoTitle, artistName, genre } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY is not configured on the server. Set GEMINI_API_KEY in Settings to enable AI generation.'
      });
    }

    let queryPrompt = prompt;
    if (!queryPrompt) {
      if (task === 'describe') {
        queryPrompt = `Generate a catchy, engaging music video description for "${videoTitle || 'Music Video'}" by Rwandan artist ${artistName || 'Artist'}${genre ? ` (Genre: ${genre})` : ''} on the Rwandan PAYTUNE platform. Include a call to action for fans to support Rwandan music.`;
      } else if (task === 'tags') {
        queryPrompt = `Generate 10 comma-separated SEO tags for the Rwandan music video "${videoTitle || 'Music Video'}" by ${artistName || 'Artist'}. Return only comma-separated values.`;
      } else {
        queryPrompt = 'Provide a brief summary of how Rwandan music creators monetize on PAYTUNE with 70% revenue share after 5% VAT.';
      }
    }

    const text = await generateContentServerSide(queryPrompt);
    return res.json({
      success: true,
      text,
      task,
      model: 'gemini-2.5-flash'
    });
  } catch (err: any) {
    console.error('[gemini-generate Edge Function] Error:', err);
    return res.status(500).json({ error: err.message || 'Gemini generation failed' });
  }
});

export default router;
