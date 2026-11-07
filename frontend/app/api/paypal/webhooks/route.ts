import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const webhookEvent = await req.json();

    console.log('[PayPal Webhook Event Received]:', {
      id: webhookEvent.id,
      event_type: webhookEvent.event_type,
      summary: webhookEvent.summary,
      resource_type: webhookEvent.resource_type,
    });

    switch (webhookEvent.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        console.log('Payment Capture Completed for resource:', webhookEvent.resource?.id);
        break;
      case 'CHECKOUT.ORDER.APPROVED':
        console.log('Checkout Order Approved:', webhookEvent.resource?.id);
        break;
      case 'MERCHANT.ONBOARDING.COMPLETED':
        console.log('Merchant Partner Onboarding Completed for:', webhookEvent.resource?.merchant_id);
        break;
      default:
        console.log('Unhandled Webhook Event:', webhookEvent.event_type);
    }

    return NextResponse.json({ received: true, event_type: webhookEvent.event_type });
  } catch (error: any) {
    console.error('Error handling PayPal webhook:', error);
    return NextResponse.json(
      { error: error.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
