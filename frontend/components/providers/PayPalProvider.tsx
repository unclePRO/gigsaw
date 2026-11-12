'use client';

import React from 'react';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';

interface PayPalProviderProps {
  children: React.ReactNode;
}

export const PayPalProvider: React.FC<PayPalProviderProps> = ({ children }) => {
  const clientId =
    process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ||
    'ATHuST02ZWliopS0gXnO6ZGroO6O0N6TxZUhQZMr553nOR76h-kYQE5TxPn5UJA8_UPG6tjkbXgAzA3V';
  const rawMerchantId =
    process.env.NEXT_PUBLIC_PAYPAL_MERCHANT_ID ||
    process.env.NEXT_PUBLIC_PAYPAL_MERCHANT_IDS?.split(',')[0]?.trim() ||
    'CPAVCGFAR2STW';

  const initialOptions: any = {
    clientId: clientId,
    currency: 'USD',
    intent: 'capture',
    // Authorized partner merchant ID for Sandbox transactions
    'merchant-id': rawMerchantId,
    'data-merchant-id': rawMerchantId,
    dataMerchantId: rawMerchantId,
    merchantId: [rawMerchantId],
  };

  return (
    <PayPalScriptProvider options={initialOptions}>
      {children}
    </PayPalScriptProvider>
  );
};
