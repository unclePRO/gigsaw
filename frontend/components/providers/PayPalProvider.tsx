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
    // In multi-seller marketplace checkout, passing an array of merchant IDs automatically
    // configures the PayPal SDK with merchant-id=* in the script URL and data-merchant-id="..." on the script tag.
    merchantId: merchantIdArray.length > 0 ? merchantIdArray : ['*'],
  };

  return (
    <PayPalScriptProvider options={initialOptions}>
      {children}
    </PayPalScriptProvider>
  );
};
