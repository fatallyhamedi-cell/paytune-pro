import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface PaymentSuccessProps {
  message: string;
  onClose: () => void;
  receiptNumber?: string;
  amount?: number | string;
  currency?: string;
}

export const PaymentSuccess: React.FC<PaymentSuccessProps> = ({
  message,
  onClose,
  receiptNumber,
  amount,
  currency = 'RWF'
}) => (
  <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
    <div className="bg-[#1A1A1A] border border-amber-500/30 p-8 rounded-2xl text-center max-w-md w-full shadow-2xl shadow-amber-500/10">
      <div className="flex justify-center mb-5">
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
          <CheckCircle2 className="w-10 h-10" />
        </div>
      </div>
      <h3 className="text-2xl font-bold text-white mb-2 tracking-tight">Payment Successful!</h3>
      <p className="text-gray-300 mb-6 text-sm leading-relaxed">{message}</p>

      {(amount || receiptNumber) && (
        <div className="bg-[#242424] rounded-xl p-3.5 mb-6 text-xs text-gray-300 border border-gray-800 space-y-1 text-left">
          {amount && (
            <div className="flex justify-between">
              <span className="text-gray-400">Amount Paid:</span>
              <span className="font-semibold text-amber-400">{amount} {currency}</span>
            </div>
          )}
          {receiptNumber && (
            <div className="flex justify-between">
              <span className="text-gray-400">Receipt Ref:</span>
              <span className="font-mono text-gray-200">{receiptNumber}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-400">Status:</span>
            <span className="text-emerald-400 font-medium">Verified & Confirmed</span>
          </div>
        </div>
      )}

      <button
        onClick={onClose}
        className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3.5 px-6 rounded-xl transition duration-150 cursor-pointer shadow-lg shadow-amber-500/25"
      >
        Continue to Content
      </button>
    </div>
  </div>
);

export default PaymentSuccess;
