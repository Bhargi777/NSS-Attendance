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
        <div className="mx-4 w-full max-w-sm animate-fade-in rounded-2xl border border-white/10 bg-black p-6 sm:p-8">
            <h3 className="mb-1 text-lg font-semibold text-white">{title}</h3>
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
                className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-base text-white outline-none focus:border-white/40"
            />

            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

            <button
                onClick={handleSubmit}
                disabled={isChecking || !passcode.trim()}
                className="mt-6 w-full rounded-xl bg-white py-3 text-sm font-semibold text-black transition-opacity active:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
            >
                {isChecking ? "Checking..." : "Unlock"}
            </button>
        </div>
    );
}
