export const config = { matcher: '/:path*' };

export default function middleware(req: Request): Response | undefined {
  const password = process.env.SITE_PASSWORD;
  if (!password) return; // no env var set → open (safe for local dev)

  const auth = req.headers.get('authorization') ?? '';
  if (auth.startsWith('Basic ')) {
    try {
      const decoded = atob(auth.slice(6));
      const colon = decoded.indexOf(':');
      const pass = colon >= 0 ? decoded.slice(colon + 1) : decoded;
      if (pass === password) return; // correct password → let through
    } catch {
      // malformed base64 → fall through to 401
    }
  }

  return new Response('Access denied', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="TutorTrack"' },
  });
}
