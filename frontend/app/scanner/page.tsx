"use client";

import { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import Link from "next/link";

interface ScannedEntry {
    rollNumber: string;
    timestamp: string;
}

export default function ScannerPage() {
    const [entries, setEntries] = useState<ScannedEntry[]>([]);
    const [manualInput, setManualInput] = useState("");
    const [isScanning, setIsScanning] = useState(false);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const [modalError, setModalError] = useState<string | null>(null);

    // Load entries from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem("nss_scanned_entries");
        if (saved) {
            try {
                setEntries(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse saved entries", e);
            }
        }
    }, []);

    // Save entries to localStorage when they change
    useEffect(() => {
        localStorage.setItem("nss_scanned_entries", JSON.stringify(entries));
    }, [entries]);

    // Auto-hide error modal after 3 seconds
    useEffect(() => {
        if (modalError) {
            const timer = setTimeout(() => {
                setModalError(null);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [modalError]);

    const startScanner = () => {
        setIsScanning(true);
        setModalError(null);

        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;

        const qrCodeSuccessCallback = (decodedText: string) => {
            addEntry(decodedText);
        };

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        html5QrCode.start({ facingMode: "environment" }, config, qrCodeSuccessCallback, undefined)
            .catch((err) => {
                console.error("Failed to start scanner", err);
                setModalError("Camera error: " + err);
                setIsScanning(false);
            });
    };

    const stopScanner = () => {
        if (scannerRef.current) {
            scannerRef.current.stop().then(() => {
                setIsScanning(false);
                scannerRef.current = null;
            }).catch((err) => {
                console.error("Failed to stop scanner", err);
            });
        } else {
            setIsScanning(false);
        }
    };

    const addEntry = (roll: string) => {
        const trimmed = roll.trim().toUpperCase();
        if (!trimmed) return;

        // IMPORTANT: Check if it's a duplicate
        const isDuplicate = entries.some(
            (e) => e.rollNumber.toUpperCase() === trimmed
        );

        if (isDuplicate) {
            setModalError(`DUPLICATE: Roll number ${trimmed} is already recorded.`);
            // Vibration feedback for mobile if supported
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate([100, 50, 100]);
            }
            return;
        }

        const newEntry: ScannedEntry = {
            rollNumber: trimmed,
            timestamp: new Date().toLocaleTimeString(),
        };

        setEntries((prev) => [newEntry, ...prev]);
        setModalError(null);

        // Success vibration
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(50);
        }
    };

    const handleManualAdd = () => {
        if (manualInput.trim()) {
            addEntry(manualInput);
            setManualInput("");
        }
    };

    const exportToCSV = () => {
        if (entries.length === 0) return;

        const headers = ["Roll Number", "Scanned At"];
        const rows = entries.map((e) => [e.rollNumber, e.timestamp]);
        const csvContent = [headers, ...rows].map((r) => r.join(",")).join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `attendance_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <main className="relative flex min-h-screen flex-col items-center bg-[#0a0a1a] p-4 text-white md:p-8">
            {/* Background Orbs */}
            <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-[#e94560]/10 blur-[120px]" />
            <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-[#533483]/10 blur-[120px]" />

            {/* ERROR MODAL */}
            {modalError && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md transition-all">
                    <div className="mx-4 w-full max-w-sm scale-110 animate-fade-in rounded-2xl border border-red-500/30 bg-[#1a0a0a] p-8 text-center shadow-[0_0_50px_rgba(233,69,96,0.3)]">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20 text-red-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                        </div>
                        <h3 className="mb-2 text-xl font-bold text-red-500">Scan Warning</h3>
                        <p className="text-white/70">{modalError}</p>
                        <p className="mt-4 text-xs text-white/30 italic">Closing in 3 seconds...</p>
                        <button
                            onClick={() => setModalError(null)}
                            className="mt-6 w-full rounded-xl bg-red-500/10 py-3 text-sm font-semibold text-red-500 hover:bg-red-500/20"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            <div className="z-10 w-full max-w-4xl">
                {/* Navigation */}
                <div className="mb-8 flex items-center justify-between">
                    <Link
                        href="/"
                        className="flex items-center gap-2 text-sm text-white/60 hover:text-white"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                        Back
                    </Link>
                    <h1 className="text-xl font-bold tracking-tight md:text-2xl">
                        Attendance Scanner
                    </h1>
                    <button
                        onClick={() => {
                            if (confirm("Are you sure you want to clear all data? This cannot be undone.")) {
                                setEntries([]);
                            }
                        }}
                        className="text-xs font-semibold uppercase tracking-wider text-red-400 hover:text-red-300"
                    >
                        Clear All
                    </button>
                </div>

                <div className="grid gap-8 lg:grid-cols-2">
                    {/* Left Column: Scanner & Manual Entry */}
                    <div className="space-y-6">
                        {/* Camera Card */}
                        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6 backdrop-blur-xl shadow-xl">
                            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/50">
                                Camera Feed
                            </h2>

                            <div
                                id="reader"
                                className={`overflow-hidden rounded-xl bg-black/60 ring-1 ring-white/10 ${!isScanning ? 'hidden' : 'block'}`}
                                style={{ minHeight: "300px" }}
                            ></div>

                            {!isScanning ? (
                                <div className="flex flex-col items-center justify-center rounded-xl bg-black/40 py-20 text-center ring-1 ring-white/5">
                                    <div className="mb-6 rounded-full bg-white/5 p-6 animate-pulse">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/20"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                                    </div>
                                    <button
                                        onClick={startScanner}
                                        className="rounded-xl bg-gradient-to-r from-[#e94560] to-[#c23152] px-10 py-4 text-sm font-black uppercase tracking-widest shadow-[0_0_20px_rgba(233,69,96,0.3)] transition-all hover:scale-[1.05] active:scale-95"
                                    >
                                        Start Scanner
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={stopScanner}
                                    className="mt-4 w-full rounded-xl border border-red-500/20 bg-red-500/5 py-4 text-sm font-bold text-red-400 transition-colors hover:bg-red-500/10"
                                >
                                    Stop Camera
                                </button>
                            )}
                        </div>

                        {/* Manual Entry Card */}
                        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6 backdrop-blur-xl shadow-xl">
                            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/50">
                                Manual Roll Entry
                            </h2>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={manualInput}
                                    onChange={(e) => setManualInput(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleManualAdd()}
                                    placeholder="Type roll number..."
                                    className="flex-1 rounded-xl border border-white/10 bg-black/40 px-5 py-4 text-sm text-white placeholder-white/20 outline-none transition-all focus:border-[#e94560]/50 focus:ring-1 focus:ring-[#e94560]/30"
                                />
                                <button
                                    onClick={handleManualAdd}
                                    className="rounded-xl bg-white/5 border border-white/10 px-8 py-4 text-sm font-bold uppercase tracking-wider transition-all hover:bg-white/10"
                                >
                                    Add
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Attendance List */}
                    <div className="flex flex-col space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50">
                                Session Log ({entries.length})
                            </h2>
                            <button
                                onClick={exportToCSV}
                                disabled={entries.length === 0}
                                className="group flex items-center gap-2 text-sm font-bold text-[#e94560] disabled:opacity-20"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-y-0.5 transition-transform"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                Export CSV
                            </button>
                        </div>

                        <div className="flex-1 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl shadow-xl">
                            <div className="max-h-[580px] overflow-y-auto scrollbar-hide">
                                <table className="w-full text-left">
                                    <thead className="sticky top-0 z-20 bg-[#16162a] text-[10px] font-black uppercase tracking-widest text-white/20">
                                        <tr>
                                            <th className="px-6 py-5">Roll Number</th>
                                            <th className="px-6 py-5">Scan Time</th>
                                            <th className="px-6 py-5 text-right">Delete</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.04]">
                                        {entries.length === 0 ? (
                                            <tr>
                                                <td colSpan={3} className="py-24 text-center">
                                                    <p className="text-sm text-white/10 italic">Waiting for scans...</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            entries.map((entry, index) => (
                                                <tr key={index} className="group transition-colors hover:bg-white/[0.02]">
                                                    <td className="px-6 py-5">
                                                        <span className="font-mono text-sm tracking-tight">{entry.rollNumber}</span>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <span className="text-xs text-white/30">{entry.timestamp}</span>
                                                    </td>
                                                    <td className="px-6 py-5 text-right">
                                                        <button
                                                            onClick={() => setEntries(entries.filter((_, i) => i !== index))}
                                                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/10 transition-all hover:bg-red-500/10 hover:text-red-500 md:opacity-0 group-hover:opacity-100"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
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
