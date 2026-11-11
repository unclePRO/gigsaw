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
  const rawMerchantIds =
    process.env.NEXT_PUBLIC_PAYPAL_MERCHANT_IDS || 'CPAVCGFAR2STW,K5DDYMC3HD53N';
  const merchantIdArray = rawMerchantIds
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const initialOptions: any = {
    clientId: clientId,
    currency: 'USD',
    intent: 'capture',
    // In multi-seller marketplace checkout, PayPal requires merchant-id=* in the script URL
    // and data-merchant-id="..." attribute on the script tag.
    'merchant-id': '*',
    'data-merchant-id': rawMerchantIds,
    dataMerchantId: rawMerchantIds,
    merchantId: merchantIdArray,
  };

  return (
    <PayPalScriptProvider options={initialOptions}>
      {children}
    </PayPalScriptProvider>
  );
};
