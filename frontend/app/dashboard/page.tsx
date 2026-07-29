"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface Attendance {
    roll_number: string;
    date: string;
    hours: number;
}

interface AttendanceTotal {
    roll_number: string;
    total_hours: number;
}

export default function DashboardPage() {
    const [rollNumbers, setRollNumbers] = useState<string[]>([]);
    const [attendance, setAttendance] = useState<Attendance[]>([]);
    const [totals, setTotals] = useState<Record<string, number>>({});
    const [dates, setDates] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            const [attendanceRes, totalsRes] = await Promise.all([
                supabase.from("attendance").select("*"),
                supabase.from("attendance_totals").select("roll_number, total_hours"),
            ]);

            if (attendanceRes.data) {
                setAttendance(attendanceRes.data);

                // Roster is whoever has been scanned at least once, sorted by roll number
                const uniqueRolls = Array.from(new Set(attendanceRes.data.map((a: Attendance) => a.roll_number)));
                uniqueRolls.sort((a, b) => a.localeCompare(b));
                setRollNumbers(uniqueRolls);

                // Extract unique dates and sort them chronologically
                const uniqueDates = Array.from(new Set(attendanceRes.data.map((a: Attendance) => a.date))).filter(Boolean) as string[];
                uniqueDates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
                setDates(uniqueDates);
            }

            if (totalsRes.data) {
                const map: Record<string, number> = {};
                totalsRes.data.forEach((t: AttendanceTotal) => {
                    map[t.roll_number] = t.total_hours;
                });
                setTotals(map);
            }

            setIsLoading(false);
        };

        fetchDashboardData();

        // Optional: Realtime updating on the dashboard
        const channel = supabase
            .channel("dashboard_changes")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "attendance" },
                () => {
                    fetchDashboardData();
                }
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "attendance_totals" },
                () => {
                    fetchDashboardData();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const getHours = (rollNumber: string, date: string) => {
        const records = attendance.filter(a => a.roll_number === rollNumber && a.date === date);
        if (records.length === 0) return null;
        return records.reduce((sum, r) => sum + (r.hours || 0), 0).toFixed(1);
    };

    const getTotalHours = (rollNumber: string) => {
        return (totals[rollNumber] || 0).toFixed(1);
    };

    return (
        <main className="relative flex min-h-screen flex-col items-center bg-black p-4 text-white md:p-8">
            {/* Background Orbs */}
            <div className="pointer-events-none fixed -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-[#e94560]/10 blur-[150px]" />
            <div className="pointer-events-none fixed -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-[#533483]/10 blur-[150px]" />

            <div className="z-10 w-full max-w-7xl">
                {/* Header Section */}
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight md:text-3xl text-white">NSS Dashboard</h1>
                        <p className="mt-1 text-sm text-white/50">Live Attendance & Working Hours Tracker</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link href="/scanner" className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-white hover:bg-white/10 border border-white/10 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                            Back to Scanner
                        </Link>
                    </div>
                </div>

                {/* Table Container */}
                <div className="w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl shadow-2xl">
                    <div className="relative overflow-x-auto">
                        <table className="w-full text-left text-sm text-white/70">
                            <thead className="bg-black/60 text-xs uppercase tracking-wider text-white/50">
                                <tr>
                                    <th className="sticky left-0 z-20 bg-black/95 px-6 py-4 font-semibold whitespace-nowrap border-b border-white/5">S.No</th>
                                    <th className="sticky left-[72px] z-20 bg-black/95 px-6 py-4 font-semibold min-w-[200px] border-b border-white/5 border-r">Roll No.</th>
                                    <th className="px-6 py-4 font-semibold whitespace-nowrap border-b border-white/5 text-center text-[#e94560]">Total Hrs</th>

                                    {/* Dynamic Date Columns */}
                                    {dates.map((date, idx) => (
                                        <th key={idx} className="px-6 py-4 font-semibold whitespace-nowrap border-b border-white/5 text-center">
                                            {new Date(date).toLocaleDateString("en-GB", { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </th>
                                    ))}
                                    {dates.length === 0 && (
                                        <th className="px-6 py-4 font-semibold whitespace-nowrap border-b border-white/5 text-center text-white/20 italic">No Sessions Yet</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.04]">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={3 + dates.length} className="px-6 py-12 text-center text-white/20 animate-pulse">
                                            Loading dashboard data...
                                        </td>
                                    </tr>
                                ) : rollNumbers.length === 0 ? (
                                    <tr>
                                        <td colSpan={3 + dates.length} className="px-6 py-12 text-center text-white/30 italic">
                                            No scans recorded yet.
                                        </td>
                                    </tr>
                                ) : (
                                    rollNumbers.map((rollNumber, idx) => (
                                        <tr key={rollNumber} className="group hover:bg-white/[0.02] transition-colors">
                                            <td className="sticky left-0 z-10 bg-black/40 group-hover:bg-[#1a1a1a] px-6 py-3 font-mono text-white/40">{idx + 1}</td>
                                            <td className="sticky left-[72px] z-10 bg-black/40 group-hover:bg-[#1a1a1a] px-6 py-3 font-mono text-xs text-white/50 border-r border-white/5">{rollNumber}</td>

                                            {/* Total Hours */}
                                            <td className="px-6 py-3 text-center font-bold text-[#e94560] bg-white/[0.01]">
                                                {getTotalHours(rollNumber)}
                                            </td>

                                            {/* Date Columns for Hours */}
                                            {dates.map(date => {
                                                const hours = getHours(rollNumber, date);
                                                return (
                                                    <td key={date} className={`px-6 py-3 text-center font-mono text-sm ${hours ? 'text-green-400 font-semibold' : 'text-white/10'}`}>
                                                        {hours ? `${hours}h` : '--'}
                                                    </td>
                                                );
                                            })}
                                            {dates.length === 0 && (
                                                <td className="px-6 py-3 text-center text-white/5">--</td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </main>
    );
}
