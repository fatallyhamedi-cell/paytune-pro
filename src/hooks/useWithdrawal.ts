import { useState } from 'react';
import axios from 'axios';

export interface WithdrawalRequestParams {
  amount: number;
  payment_method: string;
  phone: string;
  account_name?: string;
  artistId?: string;
}

export function useWithdrawal() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any>(null);

  const requestWithdrawal = async (params: WithdrawalRequestParams) => {
    setLoading(true);
    setError(null);
    setSuccessData(null);

    try {
      const minAmount = 5000;
      if (!params.amount || params.amount < minAmount) {
        throw new Error(`Minimum withdrawal amount is ${minAmount.toLocaleString()} RWF.`);
      }

      if (!params.phone || params.phone.replace(/[^0-9]/g, '').length < 9) {
        throw new Error('Please provide a valid Rwandan phone number (e.g. 0788112233).');
      }

      const res = await axios.post('/api/artist/withdraw/request', {
        amount: params.amount,
        payment_method: params.payment_method || 'MTN Mobile Money',
        phone: params.phone,
        account_name: params.account_name,
        artistId: params.artistId
      });

      setSuccessData(res.data);
      return res.data;
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Withdrawal request failed.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const getWithdrawals = async () => {
    try {
      const res = await axios.get('/api/artist/withdrawals');
      return res.data;
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Failed to fetch withdrawals history.');
    }
  };

  return {
    requestWithdrawal,
    getWithdrawals,
    loading,
    error,
    successData,
    reset: () => {
      setError(null);
      setSuccessData(null);
    }
  };
}
