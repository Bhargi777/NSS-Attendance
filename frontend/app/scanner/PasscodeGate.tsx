"use client";

import { useState } from "react";
import PasscodeForm from "@/components/PasscodeForm";
import { getStoredToken } from "@/services/sheets";

function hasValidToken(): boolean {
    const token = getStoredToken();
    if (!token) return false;
    const [expiry] = token.split(".");
    return Number(expiry) > Date.now();
}

export default function PasscodeGate({ children }: { children: React.ReactNode }) {
    const [unlocked, setUnlocked] = useState(() => (typeof window !== "undefined" ? hasValidToken() : false));

    if (!unlocked) {
        return (
            <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black px-4">
                <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-[#e94560]/20 blur-[120px]" />
                <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-[#533483]/20 blur-[120px]" />
                <PasscodeForm
                    title="Scanner Locked"
                    subtitle="This page needs the scanner passcode."
                    onSuccess={() => setUnlocked(true)}
                />
            </main>
        );
    }

    return <>{children}</>;
}
