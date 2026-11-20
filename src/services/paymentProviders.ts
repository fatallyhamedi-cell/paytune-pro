import { randomUUID } from 'crypto';
import { requestToPay, hasMtnCredentials } from './mtnService';
import { collectPayment, hasAirtelCredentials } from './airtelService';
import { createPaymentIntent, hasStripeCredentials } from './stripeService';

interface MoMoParams {
  phone: string;
  amount: number;
  provider: 'MTN' | 'Airtel';
  recipient: string;
}

export async function processMobileMoney({ phone, amount, provider, recipient }: MoMoParams): Promise<string> {
  const externalId = randomUUID();
  if (provider === 'Airtel') {
    if (!hasAirtelCredentials()) {
      const err: any = new Error('Airtel Money gateway credentials are not configured.');
      err.statusCode = 503;
      err.provider_configured = false;
      throw err;
    }
    const res = await collectPayment({
      amount,
      currency: 'RWF',
      phoneNumber: phone,
      reference: recipient || externalId,
      transactionId: externalId
    });
    return res.transactionId;
  }

  if (!hasMtnCredentials()) {
    const err: any = new Error('MTN MoMo gateway credentials are not configured.');
    err.statusCode = 503;
    err.provider_configured = false;
    throw err;
  }
  const res = await requestToPay({
    amount,
    currency: 'RWF',
    phoneNumber: phone,
    externalId,
    payerMessage: recipient ? `PAYTUNE payment to ${recipient}` : 'PAYTUNE payment'
  });
  return res.referenceId;
}

export async function processStripePayment(amount: number, currency: string = 'usd') {
  if (!hasStripeCredentials()) {
    const err: any = new Error('Stripe API credentials are not configured.');
    err.statusCode = 503;
    err.provider_configured = false;
    throw err;
  }
  const intent = await createPaymentIntent({ amount, currency });
  return {
    clientSecret: intent.clientSecret,
    transactionId: intent.intentId
  };
}

export async function disburseToArtist(phone: string, amount: number, provider: 'MTN' | 'Airtel') {
  const isMtn = provider === 'MTN';
  const configured = isMtn
    ? Boolean(process.env.MTN_SUBSCRIPTION_KEY && process.env.MTN_API_USER && process.env.MTN_API_KEY)
    : Boolean(process.env.AIRTEL_CLIENT_ID && process.env.AIRTEL_CLIENT_SECRET);

  if (!configured) {
    return {
      success: false,
      provider_configured: false,
      transactionId: null as string | null,
      error: `${provider} disbursement credentials are not configured. Transfer queued for manual reconciliation.`
    };
  }

  const err: any = new Error(
    `${provider} automated disbursement adapter requires verified business disbursement subscription key.`
  );
  err.statusCode = 503;
  err.provider_configured = false;
  throw err;
}
