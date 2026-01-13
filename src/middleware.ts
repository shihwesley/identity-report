import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedPaths = [
  '/dashboard',
  '/memory',
  '/profile',
  '/import',
  '/chat',
  '/connect',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if path is protected (dashboard routes are in route group, so pathname won't have /dashboard prefix)
  const isProtected = protectedPaths.some(p => pathname.startsWith(p));


  if (isProtected) {
    const hasSession = request.cookies.get('vault_unlocked');

    if (!hasSession) {
      const signInUrl = new URL('/signin', request.url);
      signInUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(signInUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|signin|signup|onboarding).*)',
  ],
};
