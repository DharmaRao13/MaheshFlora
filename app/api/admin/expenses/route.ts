import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuthorizationAsync } from '@/lib/auth';
import { getExpenses, createExpense } from '@/lib/db/store';
import { ExpenseCategory } from '@/types';

export const dynamic = 'force-dynamic';

const VALID_CATEGORIES: ExpenseCategory[] = ['flower_purchase', 'transport', 'packaging', 'other'];

export async function GET(req: NextRequest) {
  const auth = await verifyAdminAuthorizationAsync(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const fromDate = searchParams.get('fromDate') || undefined;
    const toDate = searchParams.get('toDate') || undefined;
    const category = searchParams.get('category') || undefined;

    const expenses = await getExpenses({ fromDate, toDate, category });
    return NextResponse.json({ success: true, expenses });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch expenses' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdminAuthorizationAsync(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { date, category, amountPaise, amountRupees, description, referenceReceipt } = body;

    // Validate date format (YYYY-MM-DD)
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: 'Valid expense date in YYYY-MM-DD format is required' },
        { status: 400 }
      );
    }

    // Validate category
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 }
      );
    }

    // Calculate paise amount (supports either amountPaise or amountRupees)
    let finalAmountPaise = 0;
    if (typeof amountPaise === 'number' && amountPaise > 0) {
      finalAmountPaise = Math.round(amountPaise);
    } else if (typeof amountRupees === 'number' && amountRupees > 0) {
      finalAmountPaise = Math.round(amountRupees * 100);
    } else if (typeof amountRupees === 'string' && !isNaN(parseFloat(amountRupees))) {
      finalAmountPaise = Math.round(parseFloat(amountRupees) * 100);
    }

    if (finalAmountPaise <= 0) {
      return NextResponse.json(
        { error: 'Expense amount must be a positive number greater than 0' },
        { status: 400 }
      );
    }

    // Validate description
    if (!description || typeof description !== 'string' || description.trim().length < 2) {
      return NextResponse.json(
        { error: 'Description must be at least 2 characters long' },
        { status: 400 }
      );
    }

    const createdBy = auth.email || 'Admin';

    const newExpense = await createExpense({
      date,
      category,
      amountPaise: finalAmountPaise,
      description: description.trim(),
      referenceReceipt: referenceReceipt ? String(referenceReceipt).trim() : undefined,
      createdBy,
    });

    return NextResponse.json({ success: true, expense: newExpense }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create expense' }, { status: 500 });
  }
}
