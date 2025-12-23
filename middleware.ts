import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { defaultLocale, locales } from "./src/lib/i18n";

const PUBLIC_FILE = /\.[^/]+$/;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const hasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  );

  if (!hasLocale) {
    const url = request.nextUrl.clone();
    url.pathname = `/${defaultLocale}${pathname}`;
    return NextResponse.redirect(url);
  }

  if (
    pathname.startsWith(`/${defaultLocale}/login`) ||
    pathname.startsWith(`/${defaultLocale}/public`) ||
    pathname.startsWith(`/${defaultLocale}/register`)
  ) {
    return NextResponse.next();
  }

  const authSecret = process.env.NEXTAUTH_SECRET;
  if (!authSecret) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret: authSecret });
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = `/${defaultLocale}/login`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
