import { NextRequest, NextResponse } from "next/server";

// Defence in depth only: keeps the scanner shell from rendering at all when
// there's no session cookie. The real gate is Apps Script rejecting writes
// without a valid token — this just avoids showing the page needlessly.
export function proxy(request: NextRequest) {
    const token = request.cookies.get("nss_scanner_token")?.value;
    if (!token) {
        return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
}

export const config = {
    matcher: "/scanner/:path*",
};
