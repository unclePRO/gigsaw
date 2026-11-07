'use client';

import React from 'react';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';

interface PayPalProviderProps {
  children: React.ReactNode;
}

export const PayPalProvider: React.FC<PayPalProviderProps> = ({ children }) => {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || 'test';

  const initialOptions = {
    clientId: clientId,
    currency: 'USD',
    intent: 'capture',
    // In multi-seller sandbox, 'merchant-id' can be passed or omitted for single order payload
  };

  return (
    <PayPalScriptProvider options={initialOptions}>
      {children}
    </PayPalScriptProvider>
  );
};
