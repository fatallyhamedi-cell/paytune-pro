// Supabase Edge Function for server-side Gemini API calls
// Keeps all Gemini API keys strictly server-side
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

interface GeminiRequest {
  prompt?: string;
  task?: "describe" | "tags" | "lyrics" | "general";
  videoTitle?: string;
  artistName?: string;
  genre?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ 
          error: "GEMINI_API_KEY is not configured in Supabase Edge Function environment secrets." 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      prompt,
      task = "general",
      videoTitle,
      artistName,
      genre
    }: GeminiRequest = await req.json();

    let constructedPrompt = prompt;
    if (!constructedPrompt) {
      if (task === "describe") {
        constructedPrompt = `Generate a compelling, engaging music video description for "${videoTitle || 'a song'}" by ${artistName || 'an artist'}${genre ? ` (Genre: ${genre})` : ''} on the Rwandan music platform PAYTUNE. Include a brief call to action for fans to support Rwandan music.`;
      } else if (task === "tags") {
        constructedPrompt = `Generate 10 relevant SEO tags and keywords for a music video titled "${videoTitle || 'Music Video'}" by ${artistName || 'Artist'}. Return only comma-separated tags.`;
      } else {
        constructedPrompt = "Provide a creative musical summary of contemporary Rwandan music culture and PayTune monetization.";
      }
    }

    // Call Google Gemini API (gemini-2.5-flash) using secret key server-side
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: constructedPrompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000
        }
      })
    });

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      return new Response(
        JSON.stringify({ error: `Gemini API returned ${geminiRes.status}: ${errBody}` }),
        { status: geminiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geminiData = await geminiRes.json();
    const candidateText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return new Response(
      JSON.stringify({
        success: true,
        text: candidateText,
        task,
        model: "gemini-2.5-flash"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Failed to execute Gemini API generation" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
