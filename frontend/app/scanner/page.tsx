"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface ScannedEntry {
    id?: string;
    roll_number: string;
    scanned_at: string;
}

export default function ScannerPage() {
    // Setup state
    const [eventDate, setEventDate] = useState(() => {
        return new Date().toISOString().split("T")[0];
    });
    const [workingHours, setWorkingHours] = useState("");
    const [isSetupDone, setIsSetupDone] = useState(false);

    // Scanner state
    const [entries, setEntries] = useState<ScannedEntry[]>([]);
    const [manualInput, setManualInput] = useState("");
    const [isScanning, setIsScanning] = useState(false);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const [modalMessage, setModalMessage] = useState<{ text: string; type: "error" | "success" } | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch entries from Supabase
    const fetchEntries = useCallback(async () => {
        const { data, error } = await supabase
            .from("attendance")
            .select("*")
            .order("scanned_at", { ascending: false });

        if (error) {
            console.error("Error fetching attendance:", error);
        } else {
            setEntries(data || []);
        }
        setIsLoading(false);
    }, []);

    // Realtime subscription (only after setup)
    useEffect(() => {
        if (!isSetupDone) return;

        fetchEntries();

        const channel = supabase
            .channel("attendance_changes")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "attendance" },
                () => {
                    fetchEntries();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [isSetupDone, fetchEntries]);

    // Auto-hide modal
    useEffect(() => {
        if (modalMessage) {
            const timer = setTimeout(() => setModalMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [modalMessage]);

    // ---- SETUP ----
    const proceedToScanning = () => {
        const hrs = parseInt(workingHours);
        if (!workingHours || isNaN(hrs) || hrs <= 0) {
            setModalMessage({ text: "Please enter valid working hours.", type: "error" });
            return;
        }
        setIsSetupDone(true);
    };

    // ---- SCANNER ----
    const startScanner = () => {
        setIsScanning(true);
        setModalMessage(null);
        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        html5QrCode
            .start(
                { facingMode: "environment" },
                config,
                (text) => addEntry(text),
                undefined
            )
            .catch((err) => {
                setModalMessage({ text: "Scanner error: " + err, type: "error" });
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
        if (!trimmed) return;

        // Local duplicate check
        if (entries.some((e) => e.roll_number === trimmed)) {
            triggerError(`DUPLICATE: ${trimmed} is already recorded.`);
            return;
        }

        const { error } = await supabase
            .from("attendance")
            .insert([{ roll_number: trimmed }]);

        if (error) {
            if (error.code === "23505") {
                triggerError(`DUPLICATE: ${trimmed} is already in the database.`);
            } else {
                triggerError("Database error: " + error.message);
            }
            return;
        }

        // Success
        setModalMessage({ text: `✓ ${trimmed} — ${workingHours}hrs recorded`, type: "success" });
        if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate(50);
        }
    };

    const triggerError = (msg: string) => {
        setModalMessage({ text: msg, type: "error" });
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

    const removeEntry = async (id: string) => {
        if (!confirm("Remove this entry?")) return;
        const { error } = await supabase.from("attendance").delete().eq("id", id);
        if (error) triggerError("Delete failed: " + error.message);
    };

    const clearAll = async () => {
        if (!confirm("DANGER: This will delete ALL attendance records. Continue?")) return;
        const { error } = await supabase
            .from("attendance")
            .delete()
            .neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) triggerError("Clear failed: " + error.message);
    };

    const exportToCSV = () => {
        if (entries.length === 0) return;
        const headers = ["S.No", "Roll Number", "Working Hours", "Date", "Scan Time"];
        const rows = entries.map((e, i) => [
            i + 1,
            e.roll_number,
            workingHours,
            eventDate,
            new Date(e.scanned_at).toLocaleString(),
        ]);
        const csvContent = [headers, ...rows].map((r) => r.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", `attendance_${eventDate}.csv`);
        link.click();
    };

    const goBackToSetup = () => {
        if (isScanning) stopScanner();
        setIsSetupDone(false);
    };

    // ==========================================
    // SHARED: Modal
    // ==========================================
    const renderModal = () => {
        if (!modalMessage) return null;
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md">
                <div
                    className={`mx-4 w-full max-w-sm animate-fade-in rounded-2xl border p-8 text-center shadow-xl ${modalMessage.type === "error"
                            ? "border-red-500/30 bg-black shadow-[0_0_50px_rgba(233,69,96,0.3)]"
                            : "border-green-500/30 bg-black shadow-[0_0_50px_rgba(34,197,94,0.3)]"
                        }`}
                >
                    <div
                        className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${modalMessage.type === "error"
                                ? "bg-red-500/20 text-red-500"
                                : "bg-green-500/20 text-green-500"
                            }`}
                    >
                        {modalMessage.type === "error" ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                        )}
                    </div>
                    <h3
                        className={`mb-2 text-xl font-bold ${modalMessage.type === "error" ? "text-red-500" : "text-green-500"
                            }`}
                    >
                        {modalMessage.type === "error" ? "Error" : "Recorded"}
                    </h3>
                    <p className="text-white/70">{modalMessage.text}</p>
                    <button
                        onClick={() => setModalMessage(null)}
                        className={`mt-6 w-full rounded-xl py-3 text-sm font-semibold ${modalMessage.type === "error"
                                ? "bg-red-500/10 text-red-500"
                                : "bg-green-500/10 text-green-500"
                            }`}
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    };

    // ==========================================
    // SCREEN 1: SETUP (Date + Working Hours)
    // ==========================================
    if (!isSetupDone) {
        return (
            <main className="relative flex min-h-screen flex-col items-center justify-center bg-black p-4 text-white">
                <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-[#e94560]/10 blur-[120px]" />
                <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-[#533483]/10 blur-[120px]" />
                {renderModal()}

                <div className="z-10 w-full max-w-md">
                    <div className="mb-8 text-center">
                        <Link
                            href="/"
                            className="mb-6 inline-flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                            Back to Home
                        </Link>
                        <h1 className="text-3xl font-bold tracking-tight">Attendance Setup</h1>
                        <p className="mt-2 text-sm text-white/40">
                            Enter the date and working hours before scanning
                        </p>
                    </div>

                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-8 backdrop-blur-xl shadow-xl space-y-6">
                        {/* Date */}
                        <div>
                            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/50">
                                Event Date <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="date"
                                value={eventDate}
                                onChange={(e) => setEventDate(e.target.value)}
                                className="w-full rounded-xl border border-white/10 bg-black/40 px-5 py-4 text-sm text-white outline-none focus:border-[#e94560]/50 transition-all [color-scheme:dark]"
                            />
                        </div>

                        {/* Working Hours — manual input */}
                        <div>
                            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/50">
                                Working Hours <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="24"
                                value={workingHours}
                                onChange={(e) => setWorkingHours(e.target.value)}
                                placeholder="Enter hours manually (e.g., 2, 4, 6)..."
                                className="w-full rounded-xl border border-white/10 bg-black/40 px-5 py-4 text-sm text-white placeholder-white/30 outline-none focus:border-[#e94560]/50 transition-all focus:bg-black/80 font-bold"
                            />
                        </div>

                        {/* Proceed */}
                        <button
                            onClick={proceedToScanning}
                            disabled={!workingHours}
                            className="group relative w-full rounded-xl bg-gradient-to-r from-[#e94560] to-[#c23152] px-10 py-4 text-xs font-black uppercase tracking-widest shadow-[0_0_20px_rgba(233,69,96,0.2)] hover:shadow-[0_0_30px_rgba(233,69,96,0.4)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            Start Scanning →
                        </button>
                    </div>
                </div>
            </main>
        );
    }

    // ==========================================
    // SCREEN 2: SCANNER + LIVE TABLE
    // ==========================================
    return (
        <main className="relative flex min-h-screen flex-col items-center bg-black p-4 text-white md:p-8">
            <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-[#e94560]/10 blur-[120px]" />
            <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-[#533483]/10 blur-[120px]" />
            {renderModal()}

            <div className="z-10 w-full max-w-4xl">
                {/* Header */}
                <div className="mb-8 flex items-center justify-between">
                    <button
                        onClick={goBackToSetup}
                        className="flex items-center gap-2 text-sm text-white/60 hover:text-white"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                        Back to Setup
                    </button>
                    <div className="text-center">
                        <h1 className="text-xl font-bold tracking-tight md:text-2xl">Cloud Scanner</h1>
                        <div className="flex items-center justify-center gap-2 text-[10px] text-green-500/50 uppercase tracking-widest">
                            <span className="h-1 w-1 bg-green-500 rounded-full animate-pulse" />
                            Supabase Connected
                        </div>
                    </div>
                    <button
                        onClick={clearAll}
                        className="px-3 py-1 text-xs font-semibold text-red-400 bg-red-400/10 rounded-lg hover:bg-red-400/20 transition-colors"
                    >
                        Clear Cloud
                    </button>
                </div>

                {/* Event Info Bar */}
                <div className="mb-6 flex items-center justify-between rounded-2xl border border-[#e94560]/20 bg-[#e94560]/5 px-6 py-4">
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#e94560]/20 text-[#e94560] font-black text-lg">
                            {workingHours}h
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-white/90">
                                {new Date(eventDate + "T00:00:00").toLocaleDateString("en-IN", {
                                    weekday: "long",
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                })}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-black text-[#e94560]">{entries.length}</p>
                        <p className="text-[10px] uppercase tracking-widest text-white/30">Scanned</p>
                    </div>
                </div>

                {/* Scanner + Manual Input */}
                <div className="mb-8 grid gap-6 lg:grid-cols-2">
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6 backdrop-blur-xl shadow-xl hover:border-white/20 transition-all duration-500">
                        <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-white/30">Live Scanner</h2>
                        <div
                            id="reader"
                            className={`overflow-hidden rounded-xl bg-black/60 ring-1 ring-white/10 ${!isScanning ? "hidden" : "block"}`}
                            style={{ minHeight: "300px" }}
                        ></div>
                        {!isScanning ? (
                            <div className="flex flex-col items-center justify-center rounded-xl bg-black/40 py-20 text-center ring-1 ring-white/5">
                                <button
                                    onClick={startScanner}
                                    className="group relative rounded-xl bg-gradient-to-r from-[#e94560] to-[#c23152] px-10 py-4 text-xs font-black uppercase tracking-widest shadow-[0_0_20px_rgba(233,69,96,0.2)] hover:shadow-[0_0_30px_rgba(233,69,96,0.4)] transition-all"
                                >
                                    <span className="relative z-10">Launch Camera</span>
                                    <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={stopScanner}
                                className="mt-4 w-full rounded-xl border border-red-500/20 bg-red-500/5 py-4 text-xs font-black uppercase tracking-widest text-red-400 hover:bg-red-500/10"
                            >
                                Stop Transmission
                            </button>
                        )}
                    </div>

                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6 backdrop-blur-xl shadow-xl">
                        <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-white/30">Manual Entry</h2>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={manualInput}
                                onChange={(e) => setManualInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleManualAdd()}
                                placeholder="Input Roll Number..."
                                className="flex-1 rounded-xl border border-white/10 bg-black/40 px-5 py-4 text-sm text-white placeholder-white/10 outline-none focus:border-[#e94560]/50 transition-all"
                            />
                            <button
                                onClick={handleManualAdd}
                                className="px-6 py-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* LIVE TABLE — below scanner */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-xs font-bold uppercase tracking-widest text-white/30">
                            Live Attendance ({entries.length})
                        </h2>
                        <button
                            onClick={exportToCSV}
                            disabled={entries.length === 0}
                            className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#e94560] disabled:opacity-20 hover:scale-105 transition-transform"
                        >
                            Export .CSV
                        </button>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl shadow-xl">
                        <div className="max-h-[500px] overflow-y-auto scrollbar-hide">
                            <table className="w-full text-left">
                                <thead className="sticky top-0 z-20 bg-black/95 backdrop-blur-sm text-[10px] font-black uppercase tracking-[0.2em] text-white/20">
                                    <tr>
                                        <th className="px-6 py-5">S.No</th>
                                        <th className="px-6 py-5">Roll No.</th>
                                        <th className="px-6 py-5">Hrs</th>
                                        <th className="px-6 py-5">Sync Time</th>
                                        <th className="px-6 py-5 text-right">Opt</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.04]">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={5} className="py-24 text-center text-white/10 animate-pulse">
                                                Syncing with cloud...
                                            </td>
                                        </tr>
                                    ) : entries.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="py-24 text-center text-white/10 italic text-sm font-light">
                                                No scans yet. Launch camera to begin.
                                            </td>
                                        </tr>
                                    ) : (
                                        entries.map((entry, index) => (
                                            <tr key={entry.id || index} className="group transition-colors hover:bg-white/[0.02]">
                                                <td className="px-6 py-4 text-sm text-white/30">{entries.length - index}</td>
                                                <td className="px-6 py-4 font-mono text-sm tracking-tighter text-white/80">
                                                    {entry.roll_number}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="rounded-md bg-green-500/10 px-2 py-1 text-xs font-bold text-green-400">
                                                        {workingHours}h
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-[10px] font-medium text-white/20">
                                                    {new Date(entry.scanned_at).toLocaleTimeString()}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => entry.id && removeEntry(entry.id)}
                                                        className="p-2 text-white/5 hover:text-red-500 transition-colors md:opacity-0 group-hover:opacity-100"
                                                    >
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
        </main>
    );
}
