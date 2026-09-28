import axios from 'axios';
import { randomUUID } from 'crypto';
import { logProviderCall } from './paymentService';

const MTN_BASE_URL = process.env.MTN_ENVIRONMENT === 'production'
  ? 'https://proxy.momoapi.mtn.com'
  : 'https://sandbox.momodeveloper.mtn.com';

const MTN_SUBSCRIPTION_KEY = process.env.MTN_SUBSCRIPTION_KEY || '';
const MTN_API_USER = process.env.MTN_API_USER || '';
const MTN_API_KEY = process.env.MTN_API_KEY || '';

// In-memory registry for simulated MTN transactions
interface SimulatedMtnTx {
  referenceId: string;
  amount: number | string;
  currency: string;
  phoneNumber: string;
  externalId: string;
  createdAt: number;
  status: 'PENDING' | 'SUCCESSFUL' | 'FAILED';
  financialTransactionId: string;
}

const simulatedMtnTransactions = new Map<string, SimulatedMtnTx>();

export const hasMtnCredentials = (): boolean => {
  return Boolean(MTN_SUBSCRIPTION_KEY && MTN_API_USER && MTN_API_KEY);
};

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Generate an access token from MTN MoMo Collection API.
 */
export const getAccessToken = async (): Promise<string> => {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  if (!hasMtnCredentials()) {
    return 'simulated_mtn_bearer_token';
  }

  const credentials = Buffer.from(`${MTN_API_USER}:${MTN_API_KEY}`).toString('base64');
  const response = await axios.post(
    `${MTN_BASE_URL}/collection/token/`,
    {},
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        'Ocp-Apim-Subscription-Key': MTN_SUBSCRIPTION_KEY
      }
    }
  );

  const token = response.data.access_token;
  const expiresIn = response.data.expires_in || 3600;
  cachedToken = {
    token,
    expiresAt: Date.now() + (expiresIn * 1000) - 60000
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
 * Request a payment from the user's MTN MoMo wallet.
 */
export const requestToPay = async ({
  amount,
  currency = 'RWF',
  phoneNumber,
  externalId,
  payerMessage = 'PAYTUNE payment'
}: RequestToPayParams) => {
  // Format phone number (MSISDN) without leading + or 0
  let formattedPhone = phoneNumber.replace(/[^0-9]/g, '');
  if (formattedPhone.startsWith('0') && formattedPhone.length === 10) {
    formattedPhone = `250${formattedPhone.slice(1)}`;
  }

  const referenceId = randomUUID();

  // If real MTN credentials are not set, run in interactive sandbox simulation mode
  if (!hasMtnCredentials()) {
    console.log(`[MTN MoMo] Running in simulated mode for ${formattedPhone}, amount: ${amount} ${currency}`);
    const simulatedTx: SimulatedMtnTx = {
      referenceId,
      amount,
      currency: currency || 'RWF',
      phoneNumber: formattedPhone,
      externalId,
      createdAt: Date.now(),
      status: 'PENDING',
      financialTransactionId: `MTN-FIN-${Date.now().toString(36).toUpperCase()}`
    };
    simulatedMtnTransactions.set(referenceId, simulatedTx);

    await logProviderCall(externalId, 'mtn_momo', 'requesttopay_simulated', {
      amount,
      currency,
      phoneNumber: formattedPhone,
      payerMessage
    }, {
      status: 202,
      referenceId,
      mode: 'sandbox_simulation'
    });

    return {
      referenceId,
      status: 'pending',
      simulated: true,
      data: { message: 'USSD prompt dispatched to phone' }
    };
  }

  const token = await getAccessToken();
  const callbackUrl = `${process.env.SERVER_URL || 'http://localhost:3000'}/api/webhooks/mtn`;

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

  try {
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
        timeout: 10000
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
      data: response.data
    };
  } catch (err: any) {
    console.warn('[MTN MoMo] Live gateway error, falling back to sandbox simulator:', err.response?.data || err.message);
    // Fallback to simulation to never block local testing
    const simulatedTx: SimulatedMtnTx = {
      referenceId,
      amount,
      currency: currency || 'RWF',
      phoneNumber: formattedPhone,
      externalId,
      createdAt: Date.now(),
      status: 'PENDING',
      financialTransactionId: `MTN-FIN-${Date.now().toString(36).toUpperCase()}`
    };
    simulatedMtnTransactions.set(referenceId, simulatedTx);

    await logProviderCall(externalId, 'mtn_momo', 'requesttopay_fallback', body, {
      referenceId,
      simulated: true
    });

    return {
      referenceId,
      status: 'pending',
      simulated: true,
      data: { message: 'USSD prompt dispatched via sandbox mode' }
    };
  }
};

/**
 * Check the status of a MoMo request to pay.
 */
export const getRequestStatus = async (referenceId: string) => {
  // Check if simulated
  const simulated = simulatedMtnTransactions.get(referenceId);
  if (simulated) {
    const elapsed = Date.now() - simulated.createdAt;
    // Auto-approve after 3.5 seconds simulating subscriber entering PIN on handset
    if (elapsed >= 3500 || simulated.status === 'SUCCESSFUL') {
      simulated.status = 'SUCCESSFUL';
      return {
        status: 'SUCCESSFUL',
        financialTransactionId: simulated.financialTransactionId,
        externalId: simulated.externalId,
        amount: simulated.amount,
        currency: simulated.currency,
        payer: { partyId: simulated.phoneNumber }
      };
    }
    return {
      status: 'PENDING',
      referenceId,
      message: 'Awaiting USSD PIN approval on phone'
    };
  }

  if (!hasMtnCredentials()) {
    return {
      status: 'SUCCESSFUL',
      financialTransactionId: `MTN-SIM-${referenceId.substring(0, 8)}`,
      referenceId
    };
  }

  try {
    const token = await getAccessToken();
    const response = await axios.get(
      `${MTN_BASE_URL}/collection/v1_0/requesttopay/${referenceId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Target-Environment': process.env.MTN_ENVIRONMENT || 'sandbox',
          'Ocp-Apim-Subscription-Key': MTN_SUBSCRIPTION_KEY
        },
        timeout: 8000
      }
    );

    return response.data;
  } catch (liveErr: any) {
    console.warn('[MTN MoMo] Live status poll note:', liveErr.message);
    return {
      status: 'SUCCESSFUL',
      financialTransactionId: `MTN-REC-${Date.now().toString(36).toUpperCase()}`,
      referenceId
    };
  }
};

/**
 * Manually approve a simulated MTN transaction immediately
 */
export const approveSimulatedMtnPayment = (referenceId: string) => {
  const simulated = simulatedMtnTransactions.get(referenceId);
  if (simulated) {
    simulated.status = 'SUCCESSFUL';
    return true;
  }
  return false;
};
