import axios from 'axios';
import { logProviderCall } from './paymentService';

const AIRTEL_BASE_URL = process.env.AIRTEL_ENVIRONMENT === 'production'
  ? 'https://openapi.airtel.africa'
  : 'https://openapiuat.airtel.africa';

const AIRTEL_CLIENT_ID = process.env.AIRTEL_CLIENT_ID || '';
const AIRTEL_CLIENT_SECRET = process.env.AIRTEL_CLIENT_SECRET || '';

export const hasAirtelCredentials = (): boolean => {
  return Boolean(AIRTEL_CLIENT_ID && AIRTEL_CLIENT_SECRET);
};

let airtelTokenCache: { token: string; expiresAt: number } | null = null;

/**
 * Obtain an OAuth2 bearer token for Airtel Africa OpenAPI.
 */
export const getAirtelToken = async (): Promise<string> => {
  if (!hasAirtelCredentials()) {
    throw new Error('Airtel Money API credentials are not configured in environment variables.');
  }

  if (airtelTokenCache && Date.now() < airtelTokenCache.expiresAt) {
    return airtelTokenCache.token;
  }

  const response = await axios.post(
    `${AIRTEL_BASE_URL}/auth/oauth2/token`,
    {
      client_id: AIRTEL_CLIENT_ID,
      client_secret: AIRTEL_CLIENT_SECRET,
      grant_type: 'client_credentials'
    },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    }
  );

  const token = response.data.access_token;
  const expiresIn = response.data.expires_in || 3600;

  airtelTokenCache = {
    token,
    expiresAt: Date.now() + expiresIn * 1000 - 30000
  };

  return token;
};

export interface CollectPaymentParams {
  amount: number | string;
  currency?: string;
  phoneNumber: string;
  reference: string;
  transactionId: string;
}

/**
 * Collect payment directly from an Airtel Money subscriber wallet via Airtel OpenAPI.
 */
export const collectPayment = async ({
  amount,
  currency = 'RWF',
  phoneNumber,
  reference,
  transactionId
}: CollectPaymentParams) => {
  if (!hasAirtelCredentials()) {
    const err: any = new Error('Airtel Money API credentials are not configured.');
    err.statusCode = 503;
    err.provider_configured = false;
    throw err;
  }

  let cleanMsisdn = phoneNumber.replace(/[^0-9]/g, '');
  if (cleanMsisdn.startsWith('250')) {
    cleanMsisdn = cleanMsisdn.slice(3);
  } else if (cleanMsisdn.startsWith('0')) {
    cleanMsisdn = cleanMsisdn.slice(1);
  }

  const token = await getAirtelToken();

  const body = {
    reference,
    subscriber: {
      country: 'RW',
      currency: currency || 'RWF',
      msisdn: cleanMsisdn
    },
    transaction: {
      amount: Number(amount),
      country: 'RW',
      currency: currency || 'RWF',
      id: transactionId
    }
  };

  const response = await axios.post(
    `${AIRTEL_BASE_URL}/merchant/v1/payments/`,
    body,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Country': 'RW',
        'X-Currency': currency || 'RWF'
      },
      timeout: 12000
    }
  );

  await logProviderCall(transactionId, 'airtel_money', 'collect_payment', body, response.data);

  return {
    transactionId,
    status: response.data.status?.success ? 'pending' : 'failed',
    provider_configured: true,
    data: response.data
  };
};

/**
 * Query live status of an Airtel Money transaction.
 */
export const getPaymentStatus = async (transactionId: string) => {
  if (!hasAirtelCredentials()) {
    const err: any = new Error('Airtel Money credentials are not configured.');
    err.statusCode = 503;
    err.provider_configured = false;
    throw err;
  }

  const token = await getAirtelToken();
  const response = await axios.get(
    `${AIRTEL_BASE_URL}/standard/v1/payments/${encodeURIComponent(transactionId)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Country': 'RW',
        'X-Currency': 'RWF'
      },
      timeout: 10000
    }
  );

  return response.data;
};
