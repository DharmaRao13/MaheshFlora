import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuthorization } from '@/lib/auth';
import { getProducts, updateProduct, addProduct } from '@/lib/db/store';

export async function GET(req: NextRequest) {
  const auth = verifyAdminAuthorization(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason }, { status: 401 });
  }

  const products = await getProducts();
  return NextResponse.json({ products });
}

export async function POST(req: NextRequest) {
  const auth = verifyAdminAuthorization(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, teluguName, description, category, pricePaise, unit, imageUrl, inStock } = body;

    if (!name || !pricePaise || !unit) {
      return NextResponse.json({ error: 'Name, price, and unit are required.' }, { status: 400 });
    }

    const newProd = await addProduct({
      name,
      teluguName,
      description: description || '',
      category: category || 'daily-puja',
      pricePaise: Number(pricePaise),
      unit,
      imageUrl: imageUrl || 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=600&q=80',
      inStock: inStock !== undefined ? Boolean(inStock) : true,
    });

    return NextResponse.json({ success: true, product: newProd });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = verifyAdminAuthorization(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, updates } = body;

    if (!id || !updates) {
      return NextResponse.json({ error: 'Product ID and updates are required.' }, { status: 400 });
    }

    const updated = await updateProduct(id, updates);
    return NextResponse.json({ success: true, product: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
