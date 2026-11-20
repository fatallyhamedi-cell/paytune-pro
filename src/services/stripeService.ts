import Stripe from 'stripe';
import { logProviderCall } from './paymentService';

let stripeInstance: Stripe | null = null;

export const hasStripeCredentials = (): boolean => {
  const key = process.env.STRIPE_SECRET_KEY || '';
  return Boolean(key && !key.includes('placeholder'));
};

export const getStripe = (): Stripe => {
  if (!hasStripeCredentials()) {
    const err: any = new Error('STRIPE_SECRET_KEY is not configured in environment variables.');
    err.statusCode = 503;
    err.provider_configured = false;
    throw err;
  }
  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
      apiVersion: '2025-02-24.acacia' as any
    });
  }
  return stripeInstance;
};

export interface CreatePaymentIntentParams {
  amount: number;
  currency?: string;
  metadata?: Record<string, string>;
}

/**
 * Create a real Stripe PaymentIntent. Throws cleanly if Stripe is not configured.
 */
export const createPaymentIntent = async ({
  amount,
  currency = 'usd',
  metadata = {}
}: CreatePaymentIntentParams) => {
  const stripeClient = getStripe();
  const cleanCurrency = (currency || 'usd').toLowerCase();

  const zeroDecimalCurrencies = ['rwf', 'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf'];
  const isZeroDecimal = zeroDecimalCurrencies.includes(cleanCurrency);
  const finalAmount = isZeroDecimal ? Math.round(amount) : Math.round(amount * 100);

  const intent = await stripeClient.paymentIntents.create({
    amount: Math.max(finalAmount, 50),
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
    intentId: intent.id,
    provider_configured: true
  };
};

/**
 * Retrieve a Stripe PaymentIntent by ID.
 */
export const retrievePaymentIntent = async (paymentIntentId: string) => {
  const stripeClient = getStripe();
  return stripeClient.paymentIntents.retrieve(paymentIntentId);
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
