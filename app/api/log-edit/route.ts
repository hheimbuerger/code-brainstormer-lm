import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nodeId, field, oldValue, newValue } = body;
    console.log(`[Node Edit] nodeId=${nodeId}, field=${field}, oldValue=${JSON.stringify(oldValue)}, newValue=${JSON.stringify(newValue)}`);
    return NextResponse.json({ status: 'ok' });
  } catch (e) {
    console.error('Error in log-edit API:', e);
    return NextResponse.json({ status: 'error', error: e?.toString() }, { status: 400 });
  }
}
