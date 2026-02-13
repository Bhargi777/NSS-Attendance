"use client";

import { useState, useEffect, useRef } from "react";
import { Html5QrcodeScanner, Html5Qrcode } from "html5-qrcode";
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
    const [error, setError] = useState("");

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

    const startScanner = () => {
        setIsScanning(true);
        setError("");

        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;

        const qrCodeSuccessCallback = (decodedText: string) => {
            addEntry(decodedText);
        };

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        html5QrCode.start({ facingMode: "environment" }, config, qrCodeSuccessCallback, undefined)
            .catch((err) => {
                console.error("Failed to start scanner", err);
                setError("Camera error: " + err);
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

        // Check if duplicate
        if (entries.some(e => e.rollNumber === trimmed)) {
            setError(`Roll number ${trimmed} already added.`);
            return;
        }

        const newEntry: ScannedEntry = {
            rollNumber: trimmed,
            timestamp: new Date().toLocaleTimeString(),
        };

        setEntries(prev => [newEntry, ...prev]);
        setError("");
    };

    const handleManualAdd = () => {
        if (manualInput.trim()) {
            addEntry(manualInput);
            setManualInput("");
        }
    };

    const removeEntry = (index: number) => {
        setEntries(prev => prev.filter((_, i) => i !== index));
    };

    const exportToCSV = () => {
        if (entries.length === 0) return;

        const headers = ["Roll Number", "Scanned At"];
        const rows = entries.map(e => [e.rollNumber, e.timestamp]);
        const csvContent = [headers, ...rows].map(r => r.join(",")).join("\n");

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

            <div className="z-10 w-full max-w-4xl">
                {/* Navigation */}
                <div className="mb-8 flex items-center justify-between">
                    <Link
                        href="/"
                        className="flex items-center gap-2 text-sm text-white/60 hover:text-white"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                        Back to Home
                    </Link>
                    <h1 className="text-xl font-bold tracking-tight md:text-2xl">
                        NSS Attendance Scanner
                    </h1>
                    <div className="w-20" /> {/* Spacer */}
                </div>

                <div className="grid gap-8 lg:grid-cols-2">
                    {/* Left Column: Scanner & Manual Entry */}
                    <div className="space-y-6">
                        {/* Camera Card */}
                        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6 backdrop-blur-xl">
                            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/50">
                                QR Scanner
                            </h2>

                            <div
                                id="reader"
                                className={`overflow-hidden rounded-xl bg-black/40 ${!isScanning ? 'hidden' : 'block'}`}
                                style={{ minHeight: "300px" }}
                            ></div>

                            {!isScanning ? (
                                <div className="flex flex-col items-center justify-center rounded-xl bg-black/40 py-20 text-center">
                                    <div className="mb-4 rounded-full bg-white/5 p-4">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/40"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                                    </div>
                                    <button
                                        onClick={startScanner}
                                        className="rounded-xl bg-gradient-to-r from-[#e94560] to-[#c23152] px-8 py-3 text-sm font-semibold shadow-lg transition-transform hover:scale-[1.02] active:scale-95"
                                    >
                                        Start Camera
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={stopScanner}
                                    className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-semibold transition-colors hover:bg-white/10"
                                >
                                    Stop Camera
                                </button>
                            )}

                            {error && (
                                <p className="mt-4 text-sm text-red-400">{error}</p>
                            )}
                        </div>

                        {/* Manual Entry Card */}
                        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6 backdrop-blur-xl">
                            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/50">
                                Manual Entry
                            </h2>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={manualInput}
                                    onChange={(e) => setManualInput(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleManualAdd()}
                                    placeholder="Enter Roll Number"
                                    className="flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-[#e94560]/50"
                                />
                                <button
                                    onClick={handleManualAdd}
                                    className="rounded-xl bg-gradient-to-r from-[#e94560] to-[#c23152] px-6 py-3 text-sm font-semibold"
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
                                Live Attendance ({entries.length})
                            </h2>
                            <button
                                onClick={exportToCSV}
                                disabled={entries.length === 0}
                                className="flex items-center gap-2 text-sm text-[#e94560] hover:underline disabled:opacity-30 disabled:no-underline"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                Export CSV
                            </button>
                        </div>

                        <div className="flex-1 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl">
                            <div className="max-h-[600px] overflow-y-auto">
                                <table className="w-full text-left">
                                    <thead className="sticky top-0 bg-[#16162a] text-xs font-semibold uppercase text-white/30">
                                        <tr>
                                            <th className="px-6 py-4">Roll Number</th>
                                            <th className="px-6 py-4">Time</th>
                                            <th className="px-6 py-4 text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {entries.length === 0 ? (
                                            <tr>
                                                <td colSpan={3} className="py-20 text-center text-sm text-white/20">
                                                    No roll numbers scanned yet
                                                </td>
                                            </tr>
                                        ) : (
                                            entries.map((entry, index) => (
                                                <tr key={index} className="group transition-colors hover:bg-white/[0.02]">
                                                    <td className="px-6 py-4 text-sm font-medium">{entry.rollNumber}</td>
                                                    <td className="px-6 py-4 text-sm text-white/40">{entry.timestamp}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <button
                                                            onClick={() => removeEntry(index)}
                                                            className="text-white/20 hover:text-red-400 group-hover:opacity-100 md:opacity-0"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {entries.length > 0 && (
                            <button
                                onClick={() => {
                                    if (confirm("Are you sure you want to clear all data?")) {
                                        setEntries([]);
                                    }
                                }}
                                className="mx-auto mt-4 text-xs text-white/20 hover:text-red-400"
                            >
                                Clear all data
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}
