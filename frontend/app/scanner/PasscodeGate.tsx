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
            <main className="flex min-h-screen flex-col items-center justify-center bg-black px-4">
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
