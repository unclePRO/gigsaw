import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ProjectModel } from '@/models/Project';
import { UserModel } from '@/models/User';
import { WorkPackage } from '@/types';
import { normalizePackageBudgets } from '@/lib/budget';

export const dynamic = 'force-dynamic';

// Helper to authenticate with PayPal REST API using /v1/oauth2/token (Basic Auth)
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
    const { projectId, project, items, totalBudget, projectName } = body as {
      projectId?: string;
      project?: any;
      items?: WorkPackage[];
      totalBudget?: number;
      projectName?: string;
    };

    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const apiBase = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        {
          error: 'PayPal credentials missing in server environment',
          details: 'NEXT_PUBLIC_PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET not configured.',
        },
        { status: 500 }
      );
    }

    await connectToDatabase();

    // Retrieve the target project and packages
    let targetProject: any = project;
    if (projectId) {
      const dbProject = await ProjectModel.findById(projectId).lean();
      if (dbProject) {
        targetProject = dbProject;
      }
    }

    const rawPackages: WorkPackage[] =
      targetProject?.workPackages || items || [];

    if (!rawPackages || rawPackages.length === 0) {
      return NextResponse.json(
        { error: 'No work packages found in project to fund.' },
        { status: 400 }
      );
    }

    // Filter to accepted packages (or all if all are accepted)
    const acceptedPackages = rawPackages.filter(
      (wp) => wp.inviteStatus === 'accepted' || rawPackages.length === 1
    );

    const packagesToFund = acceptedPackages.length > 0 ? acceptedPackages : rawPackages;

    // Ensure allocated prices strictly sum to totalBudget if all packages are being funded
    const targetBudget = Number(targetProject?.totalBudget || totalBudget);
    if (targetBudget > 0 && packagesToFund.length === rawPackages.length) {
      normalizePackageBudgets(packagesToFund, targetBudget);
    }

    const effectiveProjectName = targetProject?.projectName || projectName || 'Gigsaw Project';

    // Fetch PayPal payout emails from MongoDB users for each accepted freelancer
    const purchase_units = await Promise.all(
      packagesToFund.map(async (wp, index) => {
        let payeeEmail = wp.assignedFreelancerEmail || `freelancer-${index + 1}@sandbox.paypal.com`;

        // Lookup freelancer user profile in MongoDB Atlas
        let matchedMerchantId: string | undefined;
        if (wp.assignedFreelancerEmail || wp.assignedFreelancerId) {
          try {
            const flUser = await UserModel.findOne({
              $or: [
                ...(wp.assignedFreelancerEmail ? [{ email: wp.assignedFreelancerEmail.toLowerCase() }] : []),
                ...(wp.assignedFreelancerId ? [{ _id: wp.assignedFreelancerId }] : []),
              ],
            })
              .select('paypalEmail email name paypalMerchantId')
              .lean() as any;

            if (flUser) {
              payeeEmail = flUser.paypalEmail || flUser.email || payeeEmail;
              if (flUser.paypalMerchantId) {
                matchedMerchantId = flUser.paypalMerchantId;
              }
            }
          } catch (dbErr) {
            console.warn('[Create Order] Error finding freelancer PayPal email:', dbErr);
          }
        }

        const allocatedVal = Number(wp.allocatedPrice || 0);
        const itemPrice = (allocatedVal > 0 ? allocatedVal : 50).toFixed(2);
        const platformFeeVal = (Number(itemPrice) * 0.05).toFixed(2);

        // Sanitize reference_id to alphanumeric/underscore format (max 256 chars)
        const safeTitle = (wp.title || 'Task').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
        const safeId = (wp.id || `pkg_${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
        const referenceId = `Task_${safeTitle}_${safeId}`;

        // Map to valid PayPal Sandbox Merchant ID matching frontend data-merchant-id attribute
        const configuredMerchantIds = (process.env.NEXT_PUBLIC_PAYPAL_MERCHANT_IDS || 'CPAVCGFAR2STW,K5DDYMC3HD53N')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const fallbackMerchantId = configuredMerchantIds[index % configuredMerchantIds.length] || 'CPAVCGFAR2STW';
        const finalMerchantId = matchedMerchantId || fallbackMerchantId;

        const unit: any = {
          reference_id: referenceId,
          description: `${effectiveProjectName} - ${wp.title}`,
          amount: {
            currency_code: 'USD',
            value: itemPrice,
          },
          payee: {
            merchant_id: finalMerchantId,
          },
        };

        // Inject 5% platform fee only if enabled by environment flag
        // Wrapped in process.env.ENABLE_PLATFORM_FEES === 'true' to avoid partner permissions error during sandbox testing
        if (process.env.ENABLE_PLATFORM_FEES === 'true') {
          unit.payment_instruction = {
            disbursement_mode: 'INSTANT',
            platform_fees: [
              {
                amount: {
                  currency_code: 'USD',
                  value: platformFeeVal,
                },
              },
            ],
          };
        }

        return unit;
      })
    );

    // Authenticate with PayPal REST API
    let accessToken: string;
    try {
      accessToken = await getPayPalAccessToken(apiBase, clientId, clientSecret);
    } catch (authErr: any) {
      console.error('[PayPal Create Order Auth Error]:', authErr);
      return NextResponse.json(
        {
          error: authErr.message || 'PayPal Authentication Failed',
          rawError: authErr.rawError || authErr.message,
        },
        { status: authErr.status || 401 }
      );
    }

    // Call /v2/checkout/orders endpoint with multi-seller payload
    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units,
      application_context: {
        brand_name: 'Gigsaw AI',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        return_url: 'http://localhost:3000/dashboard',
        cancel_url: 'http://localhost:3000/dashboard',
      },
    };

    const orderResponse = await fetch(`${apiBase}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    });

    let orderData = await orderResponse.json();

    if (!orderResponse.ok) {
      console.warn('[PayPal Multi-Seller Create Order Warning]:', orderResponse.status, orderData);

      // Check if error is due to platform_fees or partner permissions in sandbox
      const errorStr = JSON.stringify(orderData);
      const isFeeError =
        errorStr.includes('PLATFORM_FEES') ||
        errorStr.includes('PAYEE_ACCOUNT_RESTRICTED') ||
        errorStr.includes('PERMISSION_DENIED') ||
        errorStr.includes('NOT_AUTHORIZED');

      if (isFeeError && process.env.ENABLE_PLATFORM_FEES === 'true') {
        console.warn('[PayPal Create Order] Retrying order creation without platform_fees due to Sandbox account limitation...');
        const retryPayload = {
          ...orderPayload,
          purchase_units: purchase_units.map((u) => {
            const { payment_instruction, ...rest } = u;
            return rest;
          }),
        };

        const retryResponse = await fetch(`${apiBase}/v2/checkout/orders`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(retryPayload),
        });

        const retryData = await retryResponse.json();
        if (retryResponse.ok) {
          return NextResponse.json({
            id: retryData.id,
            status: retryData.status,
            links: retryData.links,
            order: retryData,
            platformFeesFallbackApplied: true,
          });
        }
        orderData = retryData;
      }

      return NextResponse.json(
        {
          error: orderData.message || orderData.name || 'PayPal Order Creation Failed',
          rawError: orderData,
          details: orderData.details,
          status: orderResponse.status,
        },
        { status: orderResponse.status }
      );
    }

    return NextResponse.json({
      id: orderData.id,
      status: orderData.status,
      links: orderData.links,
      order: orderData,
    });
  } catch (err: any) {
    console.error('Unhandled error in /api/paypal/create-order:', err);
    return NextResponse.json(
      {
        error: err.message || 'Internal server error creating PayPal order',
        rawError: err.message,
      },
      { status: 500 }
    );
  }
}
