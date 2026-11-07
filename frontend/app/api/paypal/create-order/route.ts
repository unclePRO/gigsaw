import { NextRequest, NextResponse } from 'next/server';
import { WorkPackage } from '@/types';

// Helper to get PayPal OAuth2 Access Token
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
    const { items, totalBudget, projectName } = body as {
      items: WorkPackage[];
      totalBudget: number;
      projectName?: string;
    };

    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const apiBase = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';

    // Check if live sandbox credentials are configured
    const hasLiveCredentials =
      clientId &&
      clientSecret &&
      clientId !== 'your_paypal_sandbox_client_id' &&
      clientId !== 'test' &&
      clientSecret !== 'your_paypal_sandbox_client_secret';

    if (hasLiveCredentials) {
      try {
        const accessToken = await getPayPalAccessToken(apiBase, clientId, clientSecret);

        // Build Multi-Seller purchase_units array
        // Each unit corresponds to one matched freelancer with 5% platform fee
        const purchase_units = items.map((wp, index) => {
          const itemPrice = (wp.allocatedPrice || 0).toFixed(2);
          const platformFeeAmount = ((wp.allocatedPrice || 0) * 0.05).toFixed(2);

          return {
            reference_id: `wp_${wp.id || index}`,
            description: `${projectName || 'GigSaw Project'} - ${wp.title}`,
            amount: {
              currency_code: 'USD',
              value: itemPrice,
              breakdown: {
                item_total: {
                  currency_code: 'USD',
                  value: itemPrice,
                },
              },
            },
            items: [
              {
                name: wp.title,
                quantity: '1',
                unit_amount: {
                  currency_code: 'USD',
                  value: itemPrice,
                },
                category: 'DIGITAL_GOODS',
              },
            ],
            payee: {
              email_address: wp.assignedFreelancerEmail || `freelancer-${index}@sandbox.paypal.com`,
            },
            payment_instruction: {
              disbursement_mode: 'INSTANT',
              platform_fees: [
                {
                  amount: {
                    currency_code: 'USD',
                    value: platformFeeAmount,
                  },
                },
              ],
            },
          };
        });

        // Create Order via PayPal Orders v2
        const orderResponse = await fetch(`${apiBase}/v2/checkout/orders`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            intent: 'CAPTURE',
            purchase_units,
            application_context: {
              brand_name: 'GigSaw AI Checkout',
              landing_page: 'NO_PREFERENCE',
              user_action: 'PAY_NOW',
              return_url: 'http://localhost:3000/dashboard?success=true',
              cancel_url: 'http://localhost:3000/create?canceled=true',
            },
          }),
        });

        const orderData = await orderResponse.json();

        if (orderResponse.ok && orderData.id) {
          return NextResponse.json({
            id: orderData.id,
            status: orderData.status,
            links: orderData.links,
            isSimulation: false,
          });
        }

        console.warn('PayPal live API returned error, activating safe multi-seller simulation fallback:', orderData);
      } catch (authError: any) {
        console.warn('PayPal API connection error, switching to demo mode:', authError.message);
      }
    }

    // Safe Fallback / Multi-Seller Simulation Mode for instant demo
    const simulatedOrderId = `GIGSAW-PP-MULTI-${Date.now()}`;
    return NextResponse.json({
      id: simulatedOrderId,
      status: 'CREATED',
      isSimulation: true,
      simulatedPurchaseUnits: items.map((wp, idx) => ({
        unit: idx + 1,
        category: wp.category,
        freelancer: wp.assignedFreelancerName || 'Unassigned Milestone',
        payeeEmail: wp.assignedFreelancerEmail || `freelancer-${idx}@sandbox.paypal.com`,
        grossAmount: wp.allocatedPrice,
        platformFee5Percent: Math.round(wp.allocatedPrice * 0.05 * 100) / 100,
        netDisbursement: Math.round(wp.allocatedPrice * 0.95 * 100) / 100,
      })),
      message: 'Created simulated PayPal Multi-Seller Order for hackathon demo evaluation.',
    });
  } catch (err: any) {
    console.error('Error in create-order route:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create PayPal order' },
      { status: 500 }
    );
  }
}
