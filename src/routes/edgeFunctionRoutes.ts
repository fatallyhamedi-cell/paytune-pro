import { Router, Request, Response } from 'express';
import { calculateSplit, processPurchase } from '../services/paymentSplitter';
import { generateContentServerSide } from '../services/geminiService';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * Edge Function: process-payment
 * Performs payment processing, 5% VAT calculation, and 70/30 artist/owner revenue split
 */
router.post('/process-payment', authenticate, async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user;
    if (!authUser?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const {
      videoId,
      paymentPhone = '',
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

    const resolvedUserId = String(authUser.id);
    const split = calculateSplit(numericAmount);

    const purchaseRecord = await processPurchase(
      resolvedUserId,
      String(videoId),
      String(paymentPhone),
      numericAmount,
      String(transactionId),
      String(paymentMethod)
    );

    return res.json({
      success: true,
      message: 'Payment processed and revenue split successfully',
      transactionId,
      split,
      purchase: purchaseRecord
    });
  } catch (err: any) {
    console.error('[process-payment Edge Function] Error:', err);
    const statusCode = Number(err?.statusCode) || (String(err?.message || '').toLowerCase().includes('not found') ? 404 : 500);
    return res.status(statusCode).json({ error: err.message || 'Payment processing failed' });
  }
});

/**
 * Edge Function: gemini-generate
 * Server-side Gemini API generation requiring secret key and authenticated user
 */
router.post('/gemini-generate', authenticate, async (req: Request, res: Response) => {
  try {
    const { prompt, task = 'general', videoTitle, artistName, genre } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY is not configured on the server. Set GEMINI_API_KEY to enable generation.'
      });
    }

    let queryPrompt = prompt;
    if (!queryPrompt) {
      if (task === 'describe') {
        queryPrompt = `Generate a catchy, engaging music video description for "${videoTitle || 'Music Video'}" by artist ${artistName || 'Artist'}${genre ? ` (Genre: ${genre})` : ''} on PAYTUNE. Include a call to action for fans to support creators.`;
      } else if (task === 'tags') {
        queryPrompt = `Generate 10 comma-separated SEO tags for the music video "${videoTitle || 'Music Video'}" by ${artistName || 'Artist'}. Return only comma-separated values.`;
      } else {
        queryPrompt = 'Provide a brief summary of how creators monetize on PAYTUNE with 70% revenue share after 5% VAT.';
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
    return res.status(500).json({ error: err.message || 'Generation failed' });
  }
});

export default router;
