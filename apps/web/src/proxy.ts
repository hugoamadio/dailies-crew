import { type NextRequest, NextResponse } from 'next/server';
import { isAllowedHost } from './lib/host';

/** No other site may frame the panel: a disguised click could press Run now, Approve... */
function setFrameHeaders(headers: Headers, withPolicy = true): void {
  headers.set('x-frame-options', 'DENY');
  // the files route sends its own, stricter policy (it also says frame-ancestors): this one
  // would replace it
  if (withPolicy) headers.set('content-security-policy', "frame-ancestors 'none'");
}

/** Every request: refuse a Host that is not this machine (DNS rebinding), before any page runs */
export function proxy(request: NextRequest): NextResponse {
  if (!isAllowedHost(request.headers.get('host'), process.env.PORT)) {
    const refused = new NextResponse(
      'Forbidden: the panel only answers on 127.0.0.1 or localhost\n',
      {
        status: 403,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      },
    );
    setFrameHeaders(refused.headers);
    return refused;
  }
  const response = NextResponse.next();
  setFrameHeaders(response.headers, !request.nextUrl.pathname.startsWith('/files/'));
  return response;
}
