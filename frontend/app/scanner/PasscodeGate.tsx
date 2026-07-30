"use client";

import { useState } from "react";
import PasscodeForm from "@/components/PasscodeForm";
import { isUnlockedThisPageLoad, markUnlocked } from "@/services/sheets";

export default function PasscodeGate({ children }: { children: React.ReactNode }) {
    const [unlocked, setUnlocked] = useState(() => isUnlockedThisPageLoad());

    if (!unlocked) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center bg-black px-4">
                <PasscodeForm
                    title="Scanner Locked"
                    subtitle="This page needs the scanner passcode."
                    onSuccess={() => {
                        markUnlocked();
                        setUnlocked(true);
                    }}
                />
            </main>
        );
    }

    return <>{children}</>;
}
