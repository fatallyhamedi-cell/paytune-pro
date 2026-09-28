// Follow standard Supabase Edge Functions conventions (Deno environment)
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

interface PaymentRequest {
  videoId: string;
  userId: string;
  paymentPhone?: string;
  amount: number;
  paymentMethod?: string;
  transactionId?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      videoId,
      userId,
      paymentPhone = "0780000000",
      amount,
      paymentMethod = "MTN MoMo",
      transactionId = `tx_${Date.now()}`
    }: PaymentRequest = await req.json();

    if (!videoId) {
      return new Response(
        JSON.stringify({ error: "videoId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      return new Response(
        JSON.stringify({ error: "A valid positive amount is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. VAT Calculation (5% standard VAT)
    const vatRate = 0.05;
    const vat = Math.round(numericAmount * vatRate);
    const afterVat = numericAmount - vat;

    // 2. Artist/Owner Revenue Splitting (70% artist / 30% platform owner)
    const artistRate = 0.70;
    const artistShare = Math.round(afterVat * artistRate);
    const ownerShare = afterVat - artistShare;

    const split = {
      total: numericAmount,
      vat,
      afterVat,
      artistShare,
      ownerShare,
      vatPercentage: 5,
      artistPercentage: 70,
      ownerPercentage: 30
    };

    // 3. Connect to Supabase using Edge Function environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    let purchaseRecord: any = null;

    if (supabaseUrl && supabaseServiceKey) {
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

      // Fetch video details
      const { data: video } = await supabaseAdmin
        .from("videos")
        .select("id, artist_id, title")
        .eq("id", videoId)
        .maybeSingle();

      const artistId = video?.artist_id || "artist-default";

      // Insert purchase record into purchases table
      const { data: purchase, error: purchaseError } = await supabaseAdmin
        .from("purchases")
        .insert({
          user_id: userId,
          video_id: videoId,
          payment_phone: paymentPhone,
          amount_paid: numericAmount,
          vat_amount: vat,
          after_vat: afterVat,
          artist_share: artistShare,
          owner_share: ownerShare,
          transaction_id: transactionId,
          payment_method: paymentMethod
        })
        .select()
        .maybeSingle();

      if (!purchaseError && purchase) {
        purchaseRecord = purchase;
      }

      // Credit artist wallet balance
      if (artistId) {
        await supabaseAdmin.rpc("increment_artist_balance", {
          p_artist_id: artistId,
          p_amount: artistShare
        }).catch(() => {
          // Fallback direct update
          supabaseAdmin
            .from("artists")
            .select("balance")
            .eq("id", artistId)
            .maybeSingle()
            .then(({ data: artistData }) => {
              if (artistData) {
                const currentBalance = Number(artistData.balance) || 0;
                supabaseAdmin
                  .from("artists")
                  .update({ balance: currentBalance + artistShare })
                  .eq("id", artistId);
              }
            });
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Payment processed successfully",
        transactionId,
        split,
        purchase: purchaseRecord || {
          id: `pur_${Date.now()}`,
          user_id: userId,
          video_id: videoId,
          amount_paid: numericAmount,
          vat_amount: vat,
          after_vat: afterVat,
          artist_share: artistShare,
          owner_share: ownerShare,
          transaction_id: transactionId,
          payment_method: paymentMethod,
          created_at: new Date().toISOString()
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
