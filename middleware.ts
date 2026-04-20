import { NextRequest, NextResponse } from 'next/server';

export const config = { matcher: '/:path*' };

export default function middleware(req: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next(); // no password set → open

  const auth = req.headers.get('authorization');
  if (auth) {
    const encoded = auth.replace('Basic ', '');
    const decoded = atob(encoded);
    const [, pass] = decoded.split(':');
    if (pass === password) return NextResponse.next();
  }

  return new NextResponse('Access denied', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="TutorTrack"' },
  });
}
