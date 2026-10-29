import { type NextRequest, NextResponse } from 'next/server';
import { isAllowedHost } from './lib/host';

/** Every request: refuse a Host that is not this machine (DNS rebinding), before any page runs */
export function proxy(request: NextRequest): NextResponse {
  if (!isAllowedHost(request.headers.get('host'), process.env.PORT)) {
    return new NextResponse('Forbidden: the panel only answers on 127.0.0.1 or localhost\n', {
      status: 403,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
  return NextResponse.next();
}
