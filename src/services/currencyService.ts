import { Country, ExchangeRate, PaymentGatewayOption, GlobalPaymentQuote } from '../types/payment';

export const COUNTRIES: Country[] = [
  {
    id: 'c-rw',
    name: 'Rwanda',
    iso2: 'RW',
    iso3: 'RWA',
    currency_code: 'RWF',
    currency_symbol: 'RWF',
    phone_code: '+250',
    payment_gateway: 'MTN MoMo',
    supported_gateways: ['MTN MoMo', 'Airtel Money', 'eKash'],
    flag_emoji: '🇷🇼',
    region: 'East Africa',
    is_active: true
  },
  {
    id: 'c-ke',
    name: 'Kenya',
    iso2: 'KE',
    iso3: 'KEN',
    currency_code: 'KES',
    currency_symbol: 'KSh',
    phone_code: '+254',
    payment_gateway: 'M-Pesa',
    supported_gateways: ['M-Pesa'],
    flag_emoji: '🇰🇪',
    region: 'East Africa',
    is_active: true
  },
  {
    id: 'c-tz',
    name: 'Tanzania',
    iso2: 'TZ',
    iso3: 'TZA',
    currency_code: 'TZS',
    currency_symbol: 'TSh',
    phone_code: '+255',
    payment_gateway: 'M-Pesa',
    supported_gateways: ['M-Pesa', 'Airtel Money', 'Tigo Pesa'],
    flag_emoji: '🇹🇿',
    region: 'East Africa',
    is_active: true
  },
  {
    id: 'c-ug',
    name: 'Uganda',
    iso2: 'UG',
    iso3: 'UGA',
    currency_code: 'UGX',
    currency_symbol: 'USh',
    phone_code: '+256',
    payment_gateway: 'MTN MoMo',
    supported_gateways: ['MTN MoMo', 'Airtel Money'],
    flag_emoji: '🇺🇬',
    region: 'East Africa',
    is_active: true
  },
  {
    id: 'c-ng',
    name: 'Nigeria',
    iso2: 'NG',
    iso3: 'NGA',
    currency_code: 'NGN',
    currency_symbol: '₦',
    phone_code: '+234',
    payment_gateway: 'Paystack',
    supported_gateways: ['Paystack', 'Flutterwave'],
    flag_emoji: '🇳🇬',
    region: 'Africa',
    is_active: true
  },
  {
    id: 'c-za',
    name: 'South Africa',
    iso2: 'ZA',
    iso3: 'ZAF',
    currency_code: 'ZAR',
    currency_symbol: 'R',
    phone_code: '+27',
    payment_gateway: 'PayFast',
    supported_gateways: ['PayFast', 'Yoco'],
    flag_emoji: '🇿🇦',
    region: 'Africa',
    is_active: true
  },
  {
    id: 'c-in',
    name: 'India',
    iso2: 'IN',
    iso3: 'IND',
    currency_code: 'INR',
    currency_symbol: '₹',
    phone_code: '+91',
    payment_gateway: 'UPI',
    supported_gateways: ['UPI', 'Razorpay'],
    flag_emoji: '🇮🇳',
    region: 'Asia',
    is_active: true
  },
  {
    id: 'c-jp',
    name: 'Japan',
    iso2: 'JP',
    iso3: 'JPN',
    currency_code: 'JPY',
    currency_symbol: '¥',
    phone_code: '+81',
    payment_gateway: 'Stripe',
    supported_gateways: ['Stripe'],
    flag_emoji: '🇯🇵',
    region: 'Asia',
    is_active: true
  },
  {
    id: 'c-gb',
    name: 'United Kingdom',
    iso2: 'GB',
    iso3: 'GBR',
    currency_code: 'GBP',
    currency_symbol: '£',
    phone_code: '+44',
    payment_gateway: 'Stripe',
    supported_gateways: ['Stripe', 'PayPal'],
    flag_emoji: '🇬🇧',
    region: 'Europe',
    is_active: true
  },
  {
    id: 'c-eu',
    name: 'European Union (Eurozone)',
    iso2: 'EU',
    iso3: 'EUR',
    currency_code: 'EUR',
    currency_symbol: '€',
    phone_code: '+33',
    payment_gateway: 'Stripe',
    supported_gateways: ['Stripe', 'PayPal'],
    flag_emoji: '🇪🇺',
    region: 'Europe',
    is_active: true
  },
  {
    id: 'c-us',
    name: 'United States',
    iso2: 'US',
    iso3: 'USA',
    currency_code: 'USD',
    currency_symbol: '$',
    phone_code: '+1',
    payment_gateway: 'Stripe',
    supported_gateways: ['Stripe', 'PayPal'],
    flag_emoji: '🇺🇸',
    region: 'North America',
    is_active: true
  },
  {
    id: 'c-ca',
    name: 'Canada',
    iso2: 'CA',
    iso3: 'CAN',
    currency_code: 'CAD',
    currency_symbol: 'CA$',
    phone_code: '+1',
    payment_gateway: 'Stripe',
    supported_gateways: ['Stripe', 'PayPal'],
    flag_emoji: '🇨🇦',
    region: 'North America',
    is_active: true
  },
  {
    id: 'c-au',
    name: 'Australia',
    iso2: 'AU',
    iso3: 'AUS',
    currency_code: 'AUD',
    currency_symbol: 'A$',
    phone_code: '+61',
    payment_gateway: 'Stripe',
    supported_gateways: ['Stripe'],
    flag_emoji: '🇦🇺',
    region: 'Oceania',
    is_active: true
  },
  {
    id: 'c-gl',
    name: 'Global / International',
    iso2: 'XX',
    iso3: 'GLB',
    currency_code: 'USD',
    currency_symbol: '$',
    phone_code: '+1',
    payment_gateway: 'Stripe',
    supported_gateways: ['PayPal', 'Stripe'],
    flag_emoji: '🌐',
    region: 'Global',
    is_active: true
  }
];

export const EXCHANGE_RATES: Record<string, ExchangeRate> = {
  RWF: {
    id: 'rate-rwf',
    currency_code: 'RWF',
    currency_name: 'Rwandan Franc',
    currency_symbol: 'RWF',
    rate_to_rwf: 1.0,
    inverse_rate: 1.0,
    updated_at: new Date().toISOString()
  },
  USD: {
    id: 'rate-usd',
    currency_code: 'USD',
    currency_name: 'US Dollar',
    currency_symbol: '$',
    rate_to_rwf: 1420.0,
    inverse_rate: 1 / 1420.0,
    updated_at: new Date().toISOString()
  },
  KES: {
    id: 'rate-kes',
    currency_code: 'KES',
    currency_name: 'Kenyan Shilling',
    currency_symbol: 'KSh',
    rate_to_rwf: 11.0,
    inverse_rate: 1 / 11.0,
    updated_at: new Date().toISOString()
  },
  TZS: {
    id: 'rate-tzs',
    currency_code: 'TZS',
    currency_name: 'Tanzanian Shilling',
    currency_symbol: 'TSh',
    rate_to_rwf: 0.54,
    inverse_rate: 1 / 0.54,
    updated_at: new Date().toISOString()
  },
  UGX: {
    id: 'rate-ugx',
    currency_code: 'UGX',
    currency_name: 'Ugandan Shilling',
    currency_symbol: 'USh',
    rate_to_rwf: 0.38,
    inverse_rate: 1 / 0.38,
    updated_at: new Date().toISOString()
  },
  NGN: {
    id: 'rate-ngn',
    currency_code: 'NGN',
    currency_name: 'Nigerian Naira',
    currency_symbol: '₦',
    rate_to_rwf: 0.95,
    inverse_rate: 1 / 0.95,
    updated_at: new Date().toISOString()
  },
  ZAR: {
    id: 'rate-zar',
    currency_code: 'ZAR',
    currency_name: 'South African Rand',
    currency_symbol: 'R',
    rate_to_rwf: 79.0,
    inverse_rate: 1 / 79.0,
    updated_at: new Date().toISOString()
  },
  INR: {
    id: 'rate-inr',
    currency_code: 'INR',
    currency_name: 'Indian Rupee',
    currency_symbol: '₹',
    rate_to_rwf: 16.8,
    inverse_rate: 1 / 16.8,
    updated_at: new Date().toISOString()
  },
  JPY: {
    id: 'rate-jpy',
    currency_code: 'JPY',
    currency_name: 'Japanese Yen',
    currency_symbol: '¥',
    rate_to_rwf: 9.4,
    inverse_rate: 1 / 9.4,
    updated_at: new Date().toISOString()
  },
  GBP: {
    id: 'rate-gbp',
    currency_code: 'GBP',
    currency_name: 'British Pound',
    currency_symbol: '£',
    rate_to_rwf: 1860.0,
    inverse_rate: 1 / 1860.0,
    updated_at: new Date().toISOString()
  },
  EUR: {
    id: 'rate-eur',
    currency_code: 'EUR',
    currency_name: 'Euro',
    currency_symbol: '€',
    rate_to_rwf: 1540.0,
    inverse_rate: 1 / 1540.0,
    updated_at: new Date().toISOString()
  },
  CAD: {
    id: 'rate-cad',
    currency_code: 'CAD',
    currency_name: 'Canadian Dollar',
    currency_symbol: 'CA$',
    rate_to_rwf: 1040.0,
    inverse_rate: 1 / 1040.0,
    updated_at: new Date().toISOString()
  },
  AUD: {
    id: 'rate-aud',
    currency_code: 'AUD',
    currency_name: 'Australian Dollar',
    currency_symbol: 'A$',
    rate_to_rwf: 930.0,
    inverse_rate: 1 / 930.0,
    updated_at: new Date().toISOString()
  }
};

/**
 * Gateways definitions with metadata for dynamic UI and routing
 */
export const GATEWAY_DEFINITIONS: Record<string, PaymentGatewayOption> = {
  'MTN MoMo': {
    id: 'mtn_momo',
    name: 'MTN Mobile Money',
    type: 'mobile_money',
    currency: 'RWF',
    icon: 'Smartphone',
    description: 'Instant Mobile Money push prompt via MTN Rwanda / Uganda',
    input_type: 'phone',
    placeholder: '078XXXXXXX',
    helper_text: 'You will receive a USSD prompt on your phone to confirm with your MoMo PIN.'
  },
  'Airtel Money': {
    id: 'airtel_money',
    name: 'Airtel Money',
    type: 'mobile_money',
    currency: 'RWF',
    icon: 'Smartphone',
    description: 'Instant mobile wallet payment across Rwanda, Tanzania & Uganda',
    input_type: 'phone',
    placeholder: '073XXXXXXX or 075XXXXXXX',
    helper_text: 'Enter your registered Airtel Money number to authorize.'
  },
  'eKash': {
    id: 'ekash',
    name: 'eKash Rwanda',
    type: 'mobile_money',
    currency: 'RWF',
    icon: 'Smartphone',
    description: 'Rwanda national interoperable mobile payment system',
    input_type: 'phone',
    placeholder: '078XXXXXXX',
    helper_text: 'Interoperable payment across Rwandan telcos and banks.'
  },
  'M-Pesa': {
    id: 'mpesa',
    name: 'M-Pesa (Safaricom / Vodacom)',
    type: 'mobile_money',
    currency: 'KES',
    icon: 'Smartphone',
    description: 'Instant STK Push for Kenya & Tanzania M-Pesa wallets',
    input_type: 'phone',
    placeholder: '07XXXXXXXX',
    helper_text: 'An STK Push prompt will appear on your phone. Enter your M-Pesa PIN.'
  },
  'Tigo Pesa': {
    id: 'tigo_pesa',
    name: 'Tigo Pesa',
    type: 'mobile_money',
    currency: 'TZS',
    icon: 'Smartphone',
    description: 'Tanzania Tigo Pesa mobile wallet payment',
    input_type: 'phone',
    placeholder: '065XXXXXXX',
    helper_text: 'Enter your Tigo Pesa phone number.'
  },
  'Paystack': {
    id: 'paystack',
    name: 'Paystack',
    type: 'digital_wallet',
    currency: 'NGN',
    icon: 'CreditCard',
    description: 'Fast, secure cards, USSD, and bank transfers across Nigeria',
    input_type: 'phone',
    placeholder: '080XXXXXXXX or email',
    helper_text: 'Pay via Bank Transfer, USSD (*737#), or Nigerian Naira card.'
  },
  'Flutterwave': {
    id: 'flutterwave',
    name: 'Flutterwave',
    type: 'digital_wallet',
    currency: 'NGN',
    icon: 'CreditCard',
    description: 'Cards, Barter, mobile money, and accounts across Africa',
    input_type: 'phone',
    placeholder: 'Phone number or email',
    helper_text: 'Seamless payment via Flutterwave checkout.'
  },
  'PayFast': {
    id: 'payfast',
    name: 'PayFast South Africa',
    type: 'digital_wallet',
    currency: 'ZAR',
    icon: 'CreditCard',
    description: 'Instant EFT, Masterpass, and debit cards in South Africa',
    input_type: 'phone',
    placeholder: '082XXXXXXX',
    helper_text: 'Pay with Instant EFT, Capitec Pay, or card.'
  },
  'Yoco': {
    id: 'yoco',
    name: 'Yoco',
    type: 'card',
    currency: 'ZAR',
    icon: 'CreditCard',
    description: 'South African card payments and fast checkout',
    input_type: 'card',
    placeholder: 'Card number',
    helper_text: 'Secure South African card processing.'
  },
  'UPI': {
    id: 'upi',
    name: 'UPI (GPay / PhonePe / Paytm)',
    type: 'upi',
    currency: 'INR',
    icon: 'Smartphone',
    description: 'Instant real-time payment using your UPI ID in India',
    input_type: 'upi',
    placeholder: 'username@okaxis / mobile@ybl',
    helper_text: 'Enter your UPI Virtual Payment Address (VPA) to approve payment.'
  },
  'Razorpay': {
    id: 'razorpay',
    name: 'Razorpay',
    type: 'digital_wallet',
    currency: 'INR',
    icon: 'CreditCard',
    description: 'Netbanking, cards, and wallets in India',
    input_type: 'card',
    placeholder: 'Card or Netbanking ID',
    helper_text: 'Pay with Indian debit/credit cards or netbanking.'
  },
  'Stripe': {
    id: 'stripe',
    name: 'Stripe (Cards / Apple Pay / Konbini)',
    type: 'card',
    currency: 'USD',
    icon: 'CreditCard',
    description: 'Global Visa, Mastercard, Amex, Apple Pay, Google Pay',
    input_type: 'card',
    placeholder: 'Card number',
    helper_text: 'Processed securely via Stripe with 256-bit bank encryption.'
  },
  'PayPal': {
    id: 'paypal',
    name: 'PayPal',
    type: 'digital_wallet',
    currency: 'USD',
    icon: 'CreditCard',
    description: 'Worldwide PayPal account balance or linked card',
    input_type: 'email',
    placeholder: 'paypal.user@example.com',
    helper_text: 'Instant checkout using your PayPal account.'
  }
};

/**
 * Find country by ISO2, ISO3, or name
 */
export function findCountry(identifier?: string): Country {
  if (!identifier) return COUNTRIES[0]; // Rwanda default
  const clean = identifier.trim().toUpperCase();
  const found = COUNTRIES.find(
    c => c.iso2.toUpperCase() === clean || c.iso3.toUpperCase() === clean || c.name.toUpperCase() === clean
  );
  return found || COUNTRIES[0];
}

/**
 * Convert base RWF to target currency
 */
export function convertRwfToCurrency(rwfAmount: number, targetCurrency: string): { amount: number; formatted: string } {
  const rate = EXCHANGE_RATES[targetCurrency] || EXCHANGE_RATES['USD'];
  const baseRate = rate.rate_to_rwf;
  const converted = rwfAmount / baseRate;

  // Rounding rules:
  // JPY, RWF, TZS, UGX, NGN usually no cents or rounded
  let rounded: number;
  if (['RWF', 'TZS', 'UGX', 'JPY'].includes(targetCurrency)) {
    rounded = Math.round(converted);
  } else if (['KES', 'INR', 'NGN'].includes(targetCurrency)) {
    rounded = Math.round(converted * 10) / 10;
  } else {
    rounded = Math.round(converted * 100) / 100;
  }

  const symbol = rate.currency_symbol || targetCurrency;
  const formatted = formatCurrency(rounded, targetCurrency);

  return { amount: rounded, formatted };
}

/**
 * Convert local currency to base RWF
 */
export function convertCurrencyToRwf(amount: number, fromCurrency: string): number {
  const rate = EXCHANGE_RATES[fromCurrency] || EXCHANGE_RATES['USD'];
  return Math.round(amount * rate.rate_to_rwf);
}

/**
 * Format currency with symbol
 */
export function formatCurrency(amount: number, currencyCode: string): string {
  const rate = EXCHANGE_RATES[currencyCode];
  const symbol = rate?.currency_symbol || currencyCode;

  if (['RWF', 'TZS', 'UGX', 'JPY'].includes(currencyCode)) {
    return `${Math.round(amount).toLocaleString()} ${currencyCode}`;
  }

  if (currencyCode === 'USD') {
    return `$${amount.toFixed(2)} USD`;
  }
  if (currencyCode === 'EUR') {
    return `€${amount.toFixed(2)} EUR`;
  }
  if (currencyCode === 'GBP') {
    return `£${amount.toFixed(2)} GBP`;
  }
  if (currencyCode === 'KES') {
    return `KSh ${amount.toLocaleString()}`;
  }
  if (currencyCode === 'NGN') {
    return `₦${amount.toLocaleString()}`;
  }
  if (currencyCode === 'INR') {
    return `₹${amount.toLocaleString()}`;
  }
  if (currencyCode === 'ZAR') {
    return `R ${amount.toFixed(2)}`;
  }
  if (currencyCode === 'CAD') {
    return `CA$ ${amount.toFixed(2)}`;
  }
  if (currencyCode === 'AUD') {
    return `A$ ${amount.toFixed(2)}`;
  }

  return `${symbol} ${amount.toFixed(2)}`;
}

/**
 * Get gateways configured for a country
 */
export function getGatewaysForCountry(countryIso2: string): PaymentGatewayOption[] {
  const country = findCountry(countryIso2);
  const options: PaymentGatewayOption[] = [];

  for (const name of country.supported_gateways) {
    const def = GATEWAY_DEFINITIONS[name];
    if (def) {
      options.push({
        ...def,
        currency: country.currency_code
      });
    }
  }

  if (options.length === 0) {
    options.push(GATEWAY_DEFINITIONS['Stripe']);
  }

  return options;
}

/**
 * Calculate full global quote including VAT and splits
 */
export function calculateGlobalQuote(basePriceRwf: number, countryCode: string = 'RW'): GlobalPaymentQuote {
  const country = findCountry(countryCode);
  const rate = EXCHANGE_RATES[country.currency_code] || EXCHANGE_RATES['USD'];
  const conv = convertRwfToCurrency(basePriceRwf, country.currency_code);

  const vatRate = 0.05; // 5% VAT
  const vatAmountRwf = Math.round(basePriceRwf * vatRate);
  const afterVatRwf = basePriceRwf - vatAmountRwf;
  const artistShareRwf = Math.round(afterVatRwf * 0.70);
  const platformShareRwf = Math.round(afterVatRwf * 0.30);

  const vatLocal = conv.amount * vatRate;
  const artistLocal = (conv.amount - vatLocal) * 0.70;
  const platformLocal = (conv.amount - vatLocal) * 0.30;

  return {
    base_price_rwf: basePriceRwf,
    target_currency: country.currency_code,
    currency_symbol: country.currency_symbol,
    exchange_rate: rate.rate_to_rwf,
    converted_amount: conv.amount,
    vat_amount_rwf: vatAmountRwf,
    vat_amount_local: Math.round(vatLocal * 100) / 100,
    after_vat_rwf: afterVatRwf,
    artist_share_rwf: artistShareRwf,
    artist_share_local: Math.round(artistLocal * 100) / 100,
    platform_share_rwf: platformShareRwf,
    platform_share_local: Math.round(platformLocal * 100) / 100,
    country,
    available_gateways: getGatewaysForCountry(country.iso2)
  };
}
