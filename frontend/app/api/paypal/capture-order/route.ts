import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ProjectModel } from '@/models/Project';

export const dynamic = 'force-dynamic';

async function getPayPalAccessToken(apiBase: string, clientId: string, clientSecret: string): Promise<string> {
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
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData.error_description || errorData.message || `PayPal Auth Failed with status ${response.status}`;
    const err: any = new Error(errorMsg);
    err.status = response.status;
    err.rawError = errorData;
    throw err;
  }

  const data = await response.json();
  return data.access_token;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderID, projectId } = body as { orderID: string; projectId?: string };

    if (!orderID) {
      return NextResponse.json({ error: 'orderID is required' }, { status: 400 });
    }

    await connectToDatabase();

    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const apiBase = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';

    // Handle direct test/simulation mode bypass
    const isSimulated =
      orderID.startsWith('GIGSAW-') ||
      orderID.startsWith('PP-DIRECT-') ||
      orderID.startsWith('TEST-');

    if (isSimulated || !clientSecret || clientSecret.includes('your_paypal')) {
      // Update MongoDB project document status to FUNDED_IN_PROGRESS and assign capture IDs
      const projectDoc = projectId
        ? await ProjectModel.findById(projectId)
        : await ProjectModel.findOne({ $or: [{ paypalOrderId: orderID }, { status: 'READY_TO_FUND' }] });

      if (projectDoc) {
        projectDoc.status = 'FUNDED_IN_PROGRESS';
        projectDoc.paypalOrderId = orderID;
        projectDoc.workPackages.forEach((wp, idx) => {
          wp.status = 'In Progress';
          if (!wp.paypalCaptureId) {
            wp.paypalCaptureId = `PP-SIM-${Date.now()}-${idx + 1}`;
          }
        });
        await projectDoc.save();
      }

      return NextResponse.json({
        success: true,
        status: 'FUNDED_IN_PROGRESS',
        orderID,
        isSimulation: true,
        message: 'Order simulated and project status updated to FUNDED_IN_PROGRESS.',
      });
    }

    // Live PayPal Capture Order API call
    let accessToken: string;
    try {
      accessToken = await getPayPalAccessToken(apiBase, clientId!, clientSecret);
    } catch (authErr: any) {
      console.error('[PayPal Capture Auth Error]:', authErr);
      return NextResponse.json(
        {
          error: authErr.message || 'PayPal Authentication Failed',
          rawError: authErr.rawError || authErr.message,
        },
        { status: authErr.status || 401 }
      );
    }

    const captureRes = await fetch(`${apiBase}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const captureData = await captureRes.json();

    if (!captureRes.ok) {
      console.error('[PayPal Capture Order Error]:', captureRes.status, captureData);
      return NextResponse.json(
        {
          error: captureData.message || captureData.name || 'Failed to capture PayPal order',
          rawError: captureData,
          details: captureData.details,
          status: captureRes.status,
        },
        { status: captureRes.status }
      );
    }

    // Update MongoDB project document status to "FUNDED_IN_PROGRESS" and map capture IDs
    const purchaseUnits: any[] = captureData.purchase_units || [];

    const projectDoc = projectId
      ? await ProjectModel.findById(projectId)
      : await ProjectModel.findOne({ $or: [{ paypalOrderId: orderID }, { status: 'READY_TO_FUND' }] });

    if (projectDoc) {
      projectDoc.status = 'FUNDED_IN_PROGRESS';
      projectDoc.paypalOrderId = orderID;
      projectDoc.paypalCaptureData = captureData;

      projectDoc.workPackages.forEach((wp, idx) => {
        wp.status = 'In Progress';
        // Match purchase unit by reference_id or index
        const unit = purchaseUnits.find((u: any) =>
          u.reference_id && (u.reference_id.includes(wp.id) || (wp.title && u.reference_id.includes(wp.title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 20))))
        ) || purchaseUnits[idx];

        if (unit && unit.payments && unit.payments.captures && unit.payments.captures.length > 0) {
          wp.paypalCaptureId = unit.payments.captures[0].id;
        } else if (!wp.paypalCaptureId) {
          wp.paypalCaptureId = `CAP-${orderID.slice(-8)}-${idx + 1}`;
        }
      });

      await projectDoc.save();
    }

    return NextResponse.json({
      success: true,
      status: 'FUNDED_IN_PROGRESS',
      orderID: captureData.id || orderID,
      captureData,
    });
  } catch (err: any) {
    console.error('Unhandled error in capture-order route:', err);
    return NextResponse.json(
      {
        error: err.message || 'Capture failed',
        rawError: err.message,
      },
      { status: 500 }
    );
  }
}
