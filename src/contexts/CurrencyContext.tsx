import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { Country, ExchangeRate } from '../types/payment';
import { COUNTRIES, EXCHANGE_RATES, convertRwfToCurrency, findCountry } from '../services/currencyService';

interface CurrencyContextType {
  currentCountry: Country;
  currentCurrency: string;
  countries: Country[];
  exchangeRates: Record<string, ExchangeRate>;
  setCountryByCode: (code: string) => void;
  formatPrice: (basePriceRwf: number, customCurrency?: string) => string;
  convertPrice: (basePriceRwf: number, customCurrency?: string) => { amount: number; formatted: string };
  loading: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [countries, setCountries] = useState<Country[]>(COUNTRIES);
  const [exchangeRates, setExchangeRates] = useState<Record<string, ExchangeRate>>(EXCHANGE_RATES);
  const [currentCountry, setCurrentCountry] = useState<Country>(() => {
    try {
      const saved = localStorage.getItem('paytune_selected_country');
      if (saved) {
        return findCountry(saved);
      }
    } catch (e) {}
    return COUNTRIES[0]; // Rwanda default
  });

  const [loading, setLoading] = useState(false);

  // Sync with backend on mount using sessionStorage cache to prevent 429
  useEffect(() => {
    const cached = sessionStorage.getItem('currency_ctx');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.rates) setExchangeRates(parsed.rates);
        if (parsed.countries && Array.isArray(parsed.countries)) setCountries(parsed.countries);
        return;
      } catch {}
    }

    let cancelled = false;
    const fetchMetadata = async () => {
      try {
        const [cRes, rRes] = await Promise.all([
          axios.get('/api/countries').catch((err) => {
            if (err.response?.status === 429) return { data: COUNTRIES };
            return { data: COUNTRIES };
          }),
          axios.get('/api/exchange-rates').catch((err) => {
            if (err.response?.status === 429) return { data: { rates: EXCHANGE_RATES } };
            return { data: { rates: EXCHANGE_RATES } };
          })
        ]);

        if (cancelled) return;

        if (Array.isArray(cRes.data) && cRes.data.length > 0) {
          setCountries(cRes.data);
        }
        if (rRes.data?.rates) {
          setExchangeRates(rRes.data.rates);
        }

        try {
          sessionStorage.setItem('currency_ctx', JSON.stringify({
            countries: cRes.data,
            rates: rRes.data?.rates || EXCHANGE_RATES
          }));
        } catch {}
      } catch (err) {
        // Silently use defaults
      }
    };
    fetchMetadata();

    return () => {
      cancelled = true;
    };
  }, []);

  const setCountryByCode = (code: string) => {
    const country = findCountry(code);
    setCurrentCountry(country);
    try {
      localStorage.setItem('paytune_selected_country', country.iso2);
    } catch (e) {}
  };

  const convertPrice = (basePriceRwf: number, customCurrency?: string) => {
    const target = customCurrency || currentCountry.currency_code;
    return convertRwfToCurrency(basePriceRwf, target);
  };

  const formatPrice = (basePriceRwf: number, customCurrency?: string) => {
    const target = customCurrency || currentCountry.currency_code;
    if (target === 'RWF') {
      return `${Math.round(basePriceRwf).toLocaleString()} RWF`;
    }
    const conv = convertRwfToCurrency(basePriceRwf, target);
    return `${conv.formatted} (~${Math.round(basePriceRwf).toLocaleString()} RWF)`;
  };

  return (
    <CurrencyContext.Provider
      value={{
        currentCountry,
        currentCurrency: currentCountry.currency_code,
        countries,
        exchangeRates,
        setCountryByCode,
        formatPrice,
        convertPrice,
        loading
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
};

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}

export default CurrencyContext;
