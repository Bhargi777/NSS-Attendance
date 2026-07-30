// Client for the Google Apps Script Web App backing attendance data.
// Requests use Content-Type: text/plain so the browser sends them as
// "simple requests" — Apps Script cannot set custom CORS headers on a
// preflighted request, so application/json would fail cross-origin.

const API_URL = process.env.NEXT_PUBLIC_SHEETS_API_URL || "";

export const SESSION_COOKIE = "nss_scanner_token";

interface ApiResponse<T> {
    success: boolean;
    message?: string;
    code?: string;
    data?: T;
    token?: string;
}

async function callApi<T>(action: string, payload: Record<string, unknown> = {}): Promise<ApiResponse<T>> {
    if (!API_URL) {
        return { success: false, message: "NEXT_PUBLIC_SHEETS_API_URL is not configured." };
    }

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action, ...payload }),
        });
        return await response.json();
    } catch {
        return { success: false, message: "Could not reach the server. Check deployment access is set to \"Anyone\"." };
    }
}

export function getStoredToken(): string | null {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
}

export function storeToken(token: string) {
    // 12h, matches TOKEN_TTL_MS in Code.gs
    document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${12 * 60 * 60}; SameSite=Lax`;
}

export function clearToken() {
    document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0`;
}

export async function verifyPasscode(passcode: string): Promise<{ success: boolean; message?: string }> {
    const res = await callApi<never>("verifyPasscode", { passcode });
    if (res.success && res.token) {
        storeToken(res.token);
        return { success: true };
    }
    return { success: false, message: res.message || "Invalid passcode" };
}

export interface TotalsEntry {
    roll_number: string;
    total_hours: number;
    last_date: string;
    last_scanned_at: string;
}

export async function recordScan(rollNumber: string, date: string, hours: number) {
    const token = getStoredToken();
    return callApi<TotalsEntry>("recordScan", { token, rollNumber, date, hours });
}

export async function listTotals(): Promise<TotalsEntry[]> {
    const token = getStoredToken();
    const res = await callApi<TotalsEntry[]>("listTotals", { token });
    return res.success && res.data ? res.data : [];
}

export async function deleteEntry(rollNumber: string) {
    const token = getStoredToken();
    return callApi<never>("deleteEntry", { token, rollNumber });
}
