import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const secret = process.env.NEXTAUTH_SECRET || 'gigsaw_secret_key_at_least_32_chars_long_1234567890';

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const token = await getToken({ req, secret });
  const isAuthenticated = Boolean(token);
  const role = token?.role as string | undefined;

  // 1. Prevent logged-in users from seeing or submitting /login
  if (pathname === '/login') {
    if (isAuthenticated) {
      if (role === 'freelancer') {
        const dest =
          token?.isProfileComplete === false
            ? '/freelancer/profile?setup=required'
            : '/freelancer/dashboard';
        return NextResponse.redirect(new URL(dest, req.url));
      }
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    return NextResponse.next();
  }

  // 2. Protect Merchant-only routes: /dashboard and /create
  if (pathname.startsWith('/dashboard') || pathname === '/create') {
    if (!isAuthenticated) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('callbackUrl', pathname + search);
      loginUrl.searchParams.set('role', 'merchant');
      return NextResponse.redirect(loginUrl);
    }
    if (role === 'freelancer') {
      return NextResponse.redirect(new URL('/freelancer/dashboard', req.url));
    }
    return NextResponse.next();
  }

  // 3. Protect Freelancer-only routes: /freelancer/*
  if (pathname.startsWith('/freelancer')) {
    if (!isAuthenticated) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('callbackUrl', pathname + search);
      loginUrl.searchParams.set('role', 'freelancer');
      return NextResponse.redirect(loginUrl);
    }
    if (role === 'merchant') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/create',
    '/freelancer/:path*',
    '/login',
  ],
};
