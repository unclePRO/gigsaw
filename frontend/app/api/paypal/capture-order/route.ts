import { NextRequest, NextResponse } from 'next/server';

async function getPayPalAccessToken(apiBase: string, clientId: string, clientSecret: string) {
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PayPal Auth Failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderID } = body;

    if (!orderID) {
      return NextResponse.json({ error: 'orderID is required' }, { status: 400 });
    }

    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const apiBase = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';

    // If orderID is a simulation ID or no live credentials
    if (orderID.startsWith('GIGSAW-') || !clientSecret || clientSecret.includes('your_paypal')) {
      return NextResponse.json({
        success: true,
        status: 'COMPLETED',
        orderID,
        isSimulation: true,
        message: 'Order captured successfully in simulated Multi-Seller sandbox environment.',
      });
    }

    // Call live PayPal Capture API
    const accessToken = await getPayPalAccessToken(apiBase, clientId!, clientSecret);
    const captureRes = await fetch(`${apiBase}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const captureData = await captureRes.json();

    if (!captureRes.ok) {
      return NextResponse.json(
        { error: 'Failed to capture PayPal order', details: captureData },
        { status: captureRes.status }
      );
    }

    return NextResponse.json({
      success: true,
      status: captureData.status,
      orderID: captureData.id,
      captureData,
    });
  } catch (err: any) {
    console.error('Error in capture-order route:', err);
    return NextResponse.json(
      { error: err.message || 'Capture failed' },
      { status: 500 }
    );
  }
}
