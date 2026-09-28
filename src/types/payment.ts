export interface Country {
  id: string;
  name: string;
  iso2: string;
  iso3: string;
  currency_code: string;
  currency_symbol: string;
  phone_code: string;
  payment_gateway: string;
  supported_gateways: string[];
  flag_emoji: string;
  region: 'East Africa' | 'Africa' | 'Europe' | 'North America' | 'Asia' | 'Oceania' | 'Global';
  is_active: boolean;
  created_at?: string;
}

export interface ExchangeRate {
  id: string;
  currency_code: string;
  currency_name: string;
  currency_symbol: string;
  rate_to_rwf: number; // e.g. 1 USD = 1420 RWF, 1 KES = 11 RWF, 1 RWF = 1 RWF
  inverse_rate: number; // 1 RWF in foreign currency
  updated_at: string;
}

export interface PaymentGatewayOption {
  id: string;
  name: string;
  type: 'mobile_money' | 'card' | 'bank_transfer' | 'upi' | 'wallet' | 'digital_wallet';
  currency: string;
  icon: string;
  description: string;
  input_type: 'phone' | 'card' | 'upi' | 'email';
  placeholder: string;
  helper_text: string;
}

export type EscrowStatus = 'HELD_IN_ESCROW' | 'RELEASED' | 'SETTLED' | 'REFUNDED' | 'DISPUTED';

export interface EscrowTransaction {
  id: string;
  purchase_id?: string;
  video_id: string;
  video_title?: string;
  user_id: string;
  user_name?: string;
  artist_id: string;
  artist_name?: string;
  base_price_rwf: number;
  paid_currency: string;
  paid_amount: number;
  exchange_rate: number;
  vat_rate: number;
  vat_amount_rwf: number;
  after_vat_rwf: number;
  artist_share_rwf: number;
  owner_share_rwf: number;
  status: EscrowStatus;
  payment_gateway: string;
  country_code: string;
  transaction_ref: string;
  created_at: string;
  released_at?: string;
}

export interface ArtistWallet {
  artist_id: string;
  artist_name?: string;
  escrow_balance_rwf: number;
  available_balance_rwf: number;
  total_earned_rwf: number;
  total_withdrawn_rwf: number;
  currency: 'RWF';
  updated_at: string;
}

export interface PlatformWallet {
  escrow_balance_rwf: number;
  revenue_balance_rwf: number;
  vat_collected_rwf: number;
  total_settled_rwf: number;
  currency: 'RWF';
  updated_at: string;
}

export interface GlobalPaymentQuote {
  base_price_rwf: number;
  target_currency: string;
  currency_symbol: string;
  exchange_rate: number;
  converted_amount: number;
  vat_amount_rwf: number;
  vat_amount_local: number;
  after_vat_rwf: number;
  artist_share_rwf: number;
  artist_share_local: number;
  platform_share_rwf: number;
  platform_share_local: number;
  country: Country;
  available_gateways: PaymentGatewayOption[];
}
