import { Request, Response } from 'express';
import { supabaseAdmin, isSupabaseConfigured } from '../config/supabase';
import { getDbStore } from '../config/supabase_mock';
import { notifyWithdrawalRequested } from '../services/notificationService';

/**
 * Helper to resolve artist from request
 */
async function getArtistForRequest(req: Request) {
  const user = (req as any).user;
  if (!user) return null;

  // 1. Try finding artist by user_id
  if (user.artistId) {
    const { data: byArtistId } = await supabaseAdmin
      .from('artists')
      .select('*')
      .eq('id', user.artistId)
      .maybeSingle();
    if (byArtistId) return byArtistId;
  }

  const { data: artistByUserId } = await supabaseAdmin
    .from('artists')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (artistByUserId) return artistByUserId;

  // 2. Try by id if user.id is artist id
  const { data: artistById } = await supabaseAdmin
    .from('artists')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (artistById) return artistById;

  // 3. Fallback for demo artist
  const store = getDbStore();
  const mockArtist = (store.artists || []).find((a: any) => 
    a.user_id === user.id || a.id === user.id || a.email === user.email
  );

  if (mockArtist) return mockArtist;

  // Default to first approved artist in demo mode
  if (store.artists && store.artists.length > 0) {
    return store.artists[0];
  }

  return null;
}

/**
 * POST /api/artist/withdraw
 * Request payout to Rwandan Mobile Money (MTN / Airtel) or Bank
 */
export const requestWithdrawal = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { 
    amount, 
    payment_method = 'MTN Mobile Money', 
    phone, 
    account_number, 
    account_name,
    artistId: customArtistId 
  } = req.body;

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: "Service unavailable." });
  }

  try {
    let artist: any = null;
    if (customArtistId) {
      const { data: a } = await supabaseAdmin
        .from('artists')
        .select('*')
        .eq('id', customArtistId)
        .maybeSingle();
      artist = a;
    }

    if (!artist) {
      artist = await getArtistForRequest(req);
    }

    if (!artist) {
      return res.status(404).json({ error: "Artist profile not found" });
    }

    // Payout security requirement: Artists must have a verified phone number
    if (artist.phone_verified === false) {
      return res.status(403).json({
        success: false,
        error: "Phone verification is required before requesting withdrawals. Please confirm your phone number via SMS OTP.",
        code: "PHONE_NOT_VERIFIED",
        redirectTo: "/artist/verify-phone"
      });
    }

    const withdrawAmount = Number(amount);
    if (!withdrawAmount || isNaN(withdrawAmount) || withdrawAmount <= 0) {
      return res.status(400).json({ error: "Please enter a valid withdrawal amount." });
    }

    const minThreshold = Number(process.env.MIN_WITHDRAWAL_RWF || 5000);
    if (withdrawAmount < minThreshold) {
      return res.status(400).json({ 
        error: `Minimum withdrawal threshold is ${minThreshold.toLocaleString()} RWF.` 
      });
    }

    const availableBalance = Number(artist.pending_balance ?? artist.current_balance ?? 0);
    if (availableBalance < withdrawAmount) {
      return res.status(400).json({ 
        error: `Insufficient balance. Available: ${availableBalance.toLocaleString()} RWF, requested: ${withdrawAmount.toLocaleString()} RWF.` 
      });
    }

    // Destination phone / account
    const payoutDestination = phone || account_number || artist.phone || artist.momo_code || "0788112233";

    // Reference code
    const referenceCode = `PAYTUNE-WD-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Create withdrawal record
    const withdrawalRecord = {
      artist_id: artist.id,
      amount: withdrawAmount,
      phone: payoutDestination,
      payment_method,
      account_name: account_name || artist.full_name,
      status: 'pending',
      reference_code: referenceCode,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: withdrawal, error: withdrawError } = await supabaseAdmin
      .from('withdrawals')
      .insert(withdrawalRecord)
      .select()
      .single();

    if (withdrawError) {
      console.error("Failed to insert withdrawal:", withdrawError);
      return res.status(500).json({ error: "Could not create withdrawal record." });
    }

    // Deduct balance from artist
    const newPending = Math.max(0, availableBalance - withdrawAmount);
    await supabaseAdmin
      .from('artists')
      .update({
        pending_balance: newPending,
        updated_at: new Date().toISOString()
      })
      .eq('id', artist.id);

    // Trigger master notification
    try {
      notifyWithdrawalRequested({
        withdrawalId: withdrawal.id,
        artistId: artist.id,
        artistName: artist.full_name || 'Artist',
        amount: withdrawAmount,
        phone: payoutDestination,
        provider: payment_method
      });
    } catch (notifErr) {
      console.warn("Withdrawal request notification error:", notifErr);
    }

    // Return response
    res.json({
      success: true,
      message: `Withdrawal of ${withdrawAmount.toLocaleString()} RWF submitted successfully. Funds will be sent to ${payoutDestination} via ${payment_method}.`,
      withdrawal,
      new_balance: newPending
    });

  } catch (err: any) {
    console.error("requestWithdrawal error:", err);
    res.status(500).json({ error: err.message || "An error occurred while processing withdrawal." });
  }
};

/**
 * GET /api/artist/withdrawals
 * List all past withdrawals for the authenticated artist
 */
export const getArtistWithdrawals = async (req: Request, res: Response) => {
  try {
    const artist = await getArtistForRequest(req);
    if (!artist) {
      return res.status(404).json({ error: "Artist not found" });
    }

    const { data, error } = await supabaseAdmin
      .from('withdrawals')
      .select('*')
      .eq('artist_id', artist.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data || []);
  } catch (err: any) {
    console.error("getArtistWithdrawals error:", err);
    res.status(500).json({ error: err.message });
  }
};
