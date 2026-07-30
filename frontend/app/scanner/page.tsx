"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import Link from "next/link";
import PasscodeGate from "./PasscodeGate";
import { recordScan, listTotals, deleteEntry, TotalsEntry } from "@/services/sheets";

type ScannedEntry = TotalsEntry;

const REFRESH_INTERVAL_MS = 10000;

function ScannerPageInner() {
    const [entries, setEntries] = useState<ScannedEntry[]>([]);
    const [manualInput, setManualInput] = useState("");
    const [isScanning, setIsScanning] = useState(false);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const [modalError, setModalError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [adminDate] = useState<string | null>(() =>
        typeof window !== "undefined" ? localStorage.getItem("attendance_date") : null
    );
    const [adminHours] = useState<number>(() =>
        typeof window !== "undefined" ? Number(localStorage.getItem("attendance_hours")) || 2 : 2
    );

    const fetchEntries = useCallback(async (currentDate: string) => {
        const all = await listTotals();
        setEntries(
            all
                .filter((e) => e.last_date === currentDate)
                .sort((a, b) => new Date(b.last_scanned_at).getTime() - new Date(a.last_scanned_at).getTime())
        );
        setIsLoading(false);
    }, []);

    // Fetch on mount, then poll — Sheets has no realtime push.
    useEffect(() => {
        if (!adminDate) {
            window.location.href = "/";
            return;
        }

        // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching attendance rows on mount is the intended effect
        fetchEntries(adminDate);

        const interval = setInterval(() => fetchEntries(adminDate), REFRESH_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [adminDate, fetchEntries]);

    // Auto-hide error modal
    useEffect(() => {
        if (modalError) {
            const timer = setTimeout(() => setModalError(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [modalError]);

    const startScanner = () => {
        setIsScanning(true);
        setModalError(null);
        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        html5QrCode.start(
            { facingMode: "environment" },
            config,
            (text) => addEntry(text),
            undefined
        ).catch((err) => {
            setModalError("Scanner error: " + err);
            setIsScanning(false);
        });
    };

    const stopScanner = () => {
        if (scannerRef.current) {
            scannerRef.current.stop().then(() => {
                setIsScanning(false);
                scannerRef.current = null;
            });
        } else {
            setIsScanning(false);
        }
    };

    const addEntry = async (roll: string) => {
        const trimmed = roll.trim().toUpperCase();
        if (!trimmed || !adminDate) return;

        // Local check first for speed
        if (entries.some((e) => e.roll_number === trimmed)) {
            triggerError(`DUPLICATE: ${trimmed} is already recorded today.`);
            return;
        }

        const result = await recordScan(trimmed, adminDate, adminHours);

        if (!result.success) {
            if (result.code === "DUPLICATE_SCAN") {
                triggerError(`DUPLICATE: ${trimmed} is already scanned today.`);
            } else {
                triggerError("Database error: " + result.message);
            }
            return;
        }

        // Success Haptics
        if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate(50);
        }
        fetchEntries(adminDate);
    };

    const triggerError = (msg: string) => {
        setModalError(msg);
        if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
        }
    };

    const handleManualAdd = () => {
        if (manualInput.trim()) {
            addEntry(manualInput);
            setManualInput("");
        }
    };

    const removeEntry = async (rollNumber: string) => {
        if (!confirm(`Remove ${rollNumber} entirely (total hours + history)?`)) return;
        const result = await deleteEntry(rollNumber);
        if (!result.success) triggerError("Delete failed: " + result.message);
        else if (adminDate) fetchEntries(adminDate);
    };

    const exportToCSV = () => {
        if (entries.length === 0) return;
        const headers = ["Roll Number", "Total Hours", "Last Scanned"];
        const rows = entries.map((e) => [e.roll_number, e.total_hours, new Date(e.last_scanned_at).toLocaleString()]);
        const csvContent = [headers, ...rows].map((r) => r.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", `nss_attendance_${new Date().toISOString().split("T")[0]}.csv`);
        link.click();
    };

    return (
        <main className="flex min-h-screen flex-col items-center bg-black p-4 text-white sm:p-6 md:p-8">
            {/* ERROR MODAL */}
            {modalError && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4">
                    <div className="w-full max-w-sm animate-fade-in rounded-2xl border border-red-500/30 bg-black p-6 text-center sm:p-8">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-red-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                        </div>
                        <h3 className="mb-2 text-lg font-semibold text-red-400">Duplicate Found</h3>
                        <p className="text-sm text-white/60">{modalError}</p>
                        <button onClick={() => setModalError(null)} className="mt-6 w-full rounded-xl border border-white/10 py-3 text-sm font-semibold text-white active:bg-white/5">Close</button>
                    </div>
                </div>
            )}

            <div className="w-full max-w-4xl">
                <div className="mb-6 flex items-center justify-between gap-3 sm:mb-8">
                    <Link href="/" className="flex items-center gap-1.5 text-sm text-white/50 active:text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                        Back
                    </Link>
                    <div className="text-center">
                        <h1 className="text-base font-semibold tracking-tight sm:text-lg">Scanner</h1>
                        <div className="text-[10px] text-white/40">{adminDate} · {adminHours} hrs</div>
                    </div>
                    <div className="w-[42px]" />
                </div>

                <div className="grid gap-6 sm:gap-8 lg:grid-cols-2">
                    <div className="space-y-4 sm:space-y-6">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
                            <h2 className="mb-4 text-xs font-medium text-white/40">Camera</h2>
                            <div id="reader" className={`overflow-hidden rounded-xl bg-black ring-1 ring-white/10 ${!isScanning ? 'hidden' : 'block'}`} style={{ minHeight: "280px" }}></div>
                            {!isScanning ? (
                                <div className="flex flex-col items-center justify-center rounded-xl bg-black/40 py-16 text-center ring-1 ring-white/5 sm:py-20">
                                    <button onClick={startScanner} className="rounded-xl bg-white px-8 py-3.5 text-sm font-semibold text-black active:opacity-80">
                                        Start Scanning
                                    </button>
                                </div>
                            ) : (
                                <button onClick={stopScanner} className="mt-4 w-full rounded-xl border border-white/10 py-3.5 text-sm font-semibold text-white active:bg-white/5">Stop Scanning</button>
                            )}
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
                            <h2 className="mb-4 text-xs font-medium text-white/40">Manual Entry</h2>
                            <div className="flex gap-2">
                                <input type="text" value={manualInput} onChange={(e) => setManualInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleManualAdd()} placeholder="Roll number" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black px-4 py-3.5 text-base text-white placeholder-white/20 outline-none focus:border-white/40" />
                                <button onClick={handleManualAdd} className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-5 active:bg-white/10">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <h2 className="text-xs font-medium text-white/40">Today ({entries.length})</h2>
                            <button onClick={exportToCSV} disabled={entries.length === 0} className="text-xs font-medium text-white/60 disabled:opacity-20 active:text-white">
                                Export CSV
                            </button>
                        </div>

                        <div className="flex-1 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                            <div className="max-h-[480px] overflow-x-auto overflow-y-auto sm:max-h-[580px]">
                                <table className="w-full text-left">
                                    <thead className="sticky top-0 z-20 bg-black/95 text-[10px] font-medium uppercase tracking-wide text-white/30">
                                        <tr>
                                            <th className="px-4 py-3 sm:px-6 sm:py-4">Roll No.</th>
                                            <th className="px-4 py-3 sm:px-6 sm:py-4">Hrs</th>
                                            <th className="px-4 py-3 sm:px-6 sm:py-4">Time</th>
                                            <th className="px-4 py-3 sm:px-6 sm:py-4"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.06]">
                                        {isLoading ? (
                                            <tr><td colSpan={4} className="py-20 text-center text-white/20">Loading...</td></tr>
                                        ) : entries.length === 0 ? (
                                            <tr><td colSpan={4} className="py-20 text-center text-sm text-white/20">No scans yet.</td></tr>
                                        ) : (
                                            entries.map((entry) => (
                                                <tr key={entry.roll_number} className="group">
                                                    <td className="px-4 py-3.5 font-mono text-sm text-white/80 sm:px-6">{entry.roll_number}</td>
                                                    <td className="px-4 py-3.5 text-sm font-medium text-white sm:px-6">{entry.total_hours}</td>
                                                    <td className="px-4 py-3.5 text-xs text-white/30 sm:px-6">{new Date(entry.last_scanned_at).toLocaleTimeString()}</td>
                                                    <td className="px-4 py-3.5 text-right sm:px-6">
                                                        <button onClick={() => removeEntry(entry.roll_number)} className="p-1 text-white/20 active:text-red-400">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}

export default function ScannerPage() {
    return (
        <PasscodeGate>
            <ScannerPageInner />
        </PasscodeGate>
    );
}
