import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ServiceCatalogModel } from '@/models/ServiceCatalog';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');

    const query: any = {};
    if (category) {
      query.category = category;
    }

    const items = await ServiceCatalogModel.find(query).sort({ category: 1 }).lean();

    return NextResponse.json({ success: true, count: items.length, items });
  } catch (error: any) {
    console.error('Error fetching AI service catalog:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch AI service catalog' },
      { status: 500 }
    );
  }
}
