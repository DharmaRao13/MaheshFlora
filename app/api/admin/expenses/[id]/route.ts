import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuthorizationAsync } from '@/lib/auth';
import { getExpenseById, updateExpense, deleteExpense } from '@/lib/db/store';
import { ExpenseCategory } from '@/types';

export const dynamic = 'force-dynamic';

const VALID_CATEGORIES: ExpenseCategory[] = ['flower_purchase', 'transport', 'packaging', 'other'];

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdminAuthorizationAsync(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const expense = await getExpenseById(id);
  if (!expense) {
    return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, expense });
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdminAuthorizationAsync(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body = await req.json();
    const updates: any = {};

    if (body.date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
        return NextResponse.json({ error: 'Invalid date format (YYYY-MM-DD)' }, { status: 400 });
      }
      updates.date = body.date;
    }

    if (body.category) {
      if (!VALID_CATEGORIES.includes(body.category)) {
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
      }
      updates.category = body.category;
    }

    if (body.amountPaise !== undefined) {
      if (typeof body.amountPaise !== 'number' || body.amountPaise <= 0) {
        return NextResponse.json({ error: 'Amount in paise must be positive' }, { status: 400 });
      }
      updates.amountPaise = Math.round(body.amountPaise);
    } else if (body.amountRupees !== undefined) {
      const parsed = parseFloat(body.amountRupees);
      if (isNaN(parsed) || parsed <= 0) {
        return NextResponse.json({ error: 'Amount in rupees must be positive' }, { status: 400 });
      }
      updates.amountPaise = Math.round(parsed * 100);
    }

    if (body.description !== undefined) {
      if (typeof body.description !== 'string' || body.description.trim().length < 2) {
        return NextResponse.json({ error: 'Description must be at least 2 characters' }, { status: 400 });
      }
      updates.description = body.description.trim();
    }

    if (body.referenceReceipt !== undefined) {
      updates.referenceReceipt = body.referenceReceipt ? String(body.referenceReceipt).trim() : undefined;
    }

    const updated = await updateExpense(id, updates);
    return NextResponse.json({ success: true, expense: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update expense' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdminAuthorizationAsync(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const success = await deleteExpense(id);
    if (!success) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Expense deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete expense' }, { status: 500 });
  }
}
