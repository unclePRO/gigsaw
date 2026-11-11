'use client';

import React from 'react';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';

interface PayPalProviderProps {
  children: React.ReactNode;
}

export const PayPalProvider: React.FC<PayPalProviderProps> = ({ children }) => {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || 'test';
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
    dataMerchantId: rawMerchantIds,
  };

  return (
    <PayPalScriptProvider options={initialOptions}>
      {children}
    </PayPalScriptProvider>
  );
};
