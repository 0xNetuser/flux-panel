import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Auth is handled client-side since JWT is stored in localStorage
// This middleware handles basic route setup
export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
