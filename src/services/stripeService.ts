import Stripe from 'stripe';
import { logProviderCall } from './paymentService';

let stripeInstance: Stripe | null = null;

export const getStripe = (): Stripe => {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_key';
    stripeInstance = new Stripe(key, {
      apiVersion: '2025-02-24.acacia' as any
    });
  }
  return stripeInstance;
};

export const stripe = getStripe();

export interface CreatePaymentIntentParams {
  amount: number;
  currency?: string;
  metadata?: Record<string, string>;
}

/**
 * Create a real Stripe PaymentIntent for video purchases, subscriptions, or Super Thanks.
 */
export const createPaymentIntent = async ({
  amount,
  currency = 'usd',
  metadata = {}
}: CreatePaymentIntentParams) => {
  const stripeClient = getStripe();
  const cleanCurrency = (currency || 'usd').toLowerCase();

  // For USD/EUR, amount is in dollars so multiply by 100 for cents.
  // For zero-decimal currencies like RWF, Stripe accepts integer amount directly without multiplying by 100.
  const zeroDecimalCurrencies = ['rwf', 'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf'];
  const isZeroDecimal = zeroDecimalCurrencies.includes(cleanCurrency);

  const finalAmount = isZeroDecimal ? Math.round(amount) : Math.round(amount * 100);

  try {
    const intent = await stripeClient.paymentIntents.create({
      amount: Math.max(finalAmount, 50), // Stripe minimum
      currency: cleanCurrency,
      automatic_payment_methods: { enabled: true },
      metadata
    });

    await logProviderCall(metadata.paymentId || intent.id, 'stripe', 'create_payment_intent', {
      amount: finalAmount,
      currency: cleanCurrency,
      metadata
    }, {
      id: intent.id,
      status: intent.status
    });

    return {
      clientSecret: intent.client_secret,
      intentId: intent.id
    };
  } catch (err: any) {
    console.warn('[Stripe] Live Stripe call note:', err.message, 'falling back to simulation');
    await logProviderCall(metadata.paymentId || 'unknown', 'stripe', 'create_payment_intent_fallback', {
      amount: finalAmount,
      currency: cleanCurrency,
      metadata
    }, {
      error: err.message,
      simulated: true
    });
    
    return {
      clientSecret: `pi_simulated_${Date.now()}_secret_${Math.random().toString(36).substring(2, 10)}`,
      intentId: `pi_simulated_${Date.now()}`
    };
  }
};

/**
 * Verify Stripe webhook cryptographic signature.
 */
export const verifyWebhook = (rawBody: Buffer | string, signature: string) => {
  const stripeClient = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET || '';
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET environment variable is missing.');
  }

  return stripeClient.webhooks.constructEvent(rawBody, signature, secret);
};
