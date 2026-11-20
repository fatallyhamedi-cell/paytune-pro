import axios from 'axios';
import { randomUUID } from 'crypto';
import { logProviderCall } from './paymentService';

const MTN_BASE_URL = process.env.MTN_ENVIRONMENT === 'production'
  ? 'https://proxy.momoapi.mtn.com'
  : 'https://sandbox.momodeveloper.mtn.com';

const MTN_SUBSCRIPTION_KEY = process.env.MTN_SUBSCRIPTION_KEY || '';
const MTN_API_USER = process.env.MTN_API_USER || '';
const MTN_API_KEY = process.env.MTN_API_KEY || '';

export const hasMtnCredentials = (): boolean => {
  return Boolean(MTN_SUBSCRIPTION_KEY && MTN_API_USER && MTN_API_KEY);
};

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Generate an access token from MTN MoMo Collection API.
 */
export const getAccessToken = async (): Promise<string> => {
  if (!hasMtnCredentials()) {
    throw new Error('MTN MoMo API credentials are not configured in environment variables.');
  }

  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const credentials = Buffer.from(`${MTN_API_USER}:${MTN_API_KEY}`).toString('base64');
  const response = await axios.post(
    `${MTN_BASE_URL}/collection/token/`,
    {},
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        'Ocp-Apim-Subscription-Key': MTN_SUBSCRIPTION_KEY
      },
      timeout: 10000
    }
  );

  const token = response.data.access_token;
  const expiresIn = response.data.expires_in || 3600;
  cachedToken = {
    token,
    expiresAt: Date.now() + expiresIn * 1000 - 60000
  };

  return token;
};

export interface RequestToPayParams {
  amount: number | string;
  currency?: string;
  phoneNumber: string;
  externalId: string;
  payerMessage?: string;
}

/**
 * Request a payment from the user's MTN MoMo wallet via the real MTN Collection API.
 */
export const requestToPay = async ({
  amount,
  currency = 'RWF',
  phoneNumber,
  externalId,
  payerMessage = 'PAYTUNE payment'
}: RequestToPayParams) => {
  if (!hasMtnCredentials()) {
    const err: any = new Error('MTN MoMo Collection credentials are not configured.');
    err.statusCode = 503;
    err.provider_configured = false;
    throw err;
  }

  let formattedPhone = phoneNumber.replace(/[^0-9]/g, '');
  if (formattedPhone.startsWith('0') && formattedPhone.length === 10) {
    formattedPhone = `250${formattedPhone.slice(1)}`;
  }

  const referenceId = randomUUID();
  const token = await getAccessToken();
  const callbackUrl = `${process.env.CLIENT_URL || process.env.SERVER_URL || 'http://localhost:3000'}/api/webhooks/mtn`;

  const body = {
    amount: String(amount),
    currency: currency || 'RWF',
    externalId,
    payer: {
      partyIdType: 'MSISDN',
      partyId: formattedPhone
    },
    payerMessage: payerMessage || 'PAYTUNE payment',
    payeeNote: 'PAYTUNE streaming'
  };

  const response = await axios.post(
    `${MTN_BASE_URL}/collection/v1_0/requesttopay`,
    body,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Reference-Id': referenceId,
        'X-Target-Environment': process.env.MTN_ENVIRONMENT || 'sandbox',
        'Ocp-Apim-Subscription-Key': MTN_SUBSCRIPTION_KEY,
        'X-Callback-Url': callbackUrl,
        'Content-Type': 'application/json'
      },
      timeout: 12000
    }
  );

  await logProviderCall(externalId, 'mtn_momo', 'requesttopay', body, {
    status: response.status,
    referenceId,
    data: response.data
  });

  return {
    referenceId,
    status: response.status === 202 ? 'pending' : 'submitted',
    provider_configured: true,
    data: response.data
  };
};

/**
 * Query live status of an MTN MoMo transaction.
 */
export const getRequestStatus = async (referenceId: string) => {
  if (!hasMtnCredentials()) {
    const err: any = new Error('MTN MoMo credentials are not configured.');
    err.statusCode = 503;
    err.provider_configured = false;
    throw err;
  }

  const token = await getAccessToken();
  const response = await axios.get(
    `${MTN_BASE_URL}/collection/v1_0/requesttopay/${encodeURIComponent(referenceId)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Target-Environment': process.env.MTN_ENVIRONMENT || 'sandbox',
        'Ocp-Apim-Subscription-Key': MTN_SUBSCRIPTION_KEY
      },
      timeout: 10000
    }
  );

  return response.data;
};
