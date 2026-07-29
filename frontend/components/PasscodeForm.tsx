"use client";

import { useState } from "react";
import { verifyPasscode } from "@/services/sheets";

interface PasscodeFormProps {
    onSuccess: () => void;
    title?: string;
    subtitle?: string;
}

export default function PasscodeForm({
    onSuccess,
    title = "Admin Access",
    subtitle = "Enter the scanner passcode to continue.",
}: PasscodeFormProps) {
    const [passcode, setPasscode] = useState("");
    const [error, setError] = useState("");
    const [isChecking, setIsChecking] = useState(false);

    const handleSubmit = async () => {
        if (!passcode.trim()) return;
        setIsChecking(true);
        setError("");

        const result = await verifyPasscode(passcode.trim());

        setIsChecking(false);
        if (result.success) {
            onSuccess();
        } else {
            setError(result.message || "Invalid passcode");
            setPasscode("");
        }
    };

    return (
        <div className="mx-4 w-full max-w-sm animate-fade-in rounded-2xl border border-white/[0.08] bg-black p-8 shadow-2xl">
            <h3 className="mb-1 text-xl font-bold text-white">{title}</h3>
            <p className="mb-6 text-sm text-white/40">{subtitle}</p>

            <input
                type="password"
                value={passcode}
                onChange={(e) => {
                    setPasscode(e.target.value);
                    if (error) setError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && !isChecking && handleSubmit()}
                placeholder="Passcode"
                autoFocus
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:border-[#e94560]/50"
            />

            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

            <button
                onClick={handleSubmit}
                disabled={isChecking || !passcode.trim()}
                className="mt-6 w-full rounded-xl bg-gradient-to-r from-[#e94560] to-[#c23152] py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
            >
                {isChecking ? "Checking..." : "Unlock"}
            </button>
        </div>
    );
}
