"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateQR } from "@/services/api";
import QRModal from "@/components/QRModal";
import PasscodeForm from "@/components/PasscodeForm";
import { isUnlockedThisPageLoad, markUnlocked } from "@/services/sheets";

type AdminStep = "closed" | "passcode" | "setup";

export default function Home() {
  const router = useRouter();
  const [rollNumber, setRollNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [qrImageBase64, setQrImageBase64] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState("");

  const [adminStep, setAdminStep] = useState<AdminStep>("closed");
  const [adminDate, setAdminDate] = useState(new Date().toISOString().split("T")[0]);
  const [adminHours, setAdminHours] = useState("2");

  const openAdminPanel = () => {
    setAdminStep(isUnlockedThisPageLoad() ? "setup" : "passcode");
  };

  const handleGenerate = async () => {
    setError("");

    const trimmed = rollNumber.trim();
    if (!trimmed) {
      setError("Please enter a roll number.");
      return;
    }
    if (trimmed.length < 5 || trimmed.length > 20) {
      setError("Roll number must be between 5 and 20 characters.");
      return;
    }
    if (!/^[a-zA-Z0-9.\-]+$/.test(trimmed)) {
      setError("Roll number must contain only letters, numbers, dots, and hyphens.");
      return;
    }

    setIsLoading(true);

    try {
      const data = await generateQR(trimmed);

      if (data.success && data.image) {
        setQrImageBase64(data.image);
        setIsModalOpen(true);
      } else {
        setError(data.message || "Failed to generate QR code.");
      }
    } catch {
      setError("Could not connect to the server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isLoading) {
      handleGenerate();
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black px-4 py-8">
      {/* Card */}
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
            QR Generator
          </h1>
          <p className="mt-2 text-sm text-white/40">
            Enter your roll number to generate a QR code
          </p>
        </div>

        {/* Input */}
        <div className="mb-6">
          <label
            htmlFor="roll-number-input"
            className="mb-2 block text-xs font-medium text-white/40"
          >
            Roll Number
          </label>
          <input
            id="roll-number-input"
            type="text"
            value={rollNumber}
            onChange={(e) => {
              setRollNumber(e.target.value);
              if (error) setError("");
            }}
            onKeyDown={handleKeyPress}
            placeholder="e.g. CB.EN.U4CSE12345"
            maxLength={20}
            className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-base text-white placeholder-white/25 outline-none transition-colors focus:border-white/40"
          />

          {/* Error message */}
          {error && (
            <p id="error-message" className="mt-2 text-xs text-red-400">
              {error}
            </p>
          )}
        </div>

        {/* Generate button */}
        <button
          id="generate-btn"
          onClick={handleGenerate}
          disabled={isLoading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-black transition-opacity active:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isLoading ? (
            <>
              <svg
                className="h-5 w-5 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Generating...
            </>
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
              </svg>
              Generate QR Code
            </>
          )}
        </button>
      </div>

      {/* Admin Panel: passcode step */}
      {adminStep === "passcode" && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md">
          <PasscodeForm
            subtitle="Enter the scanner passcode to open the admin panel."
            onSuccess={() => {
              markUnlocked();
              setAdminStep("setup");
            }}
          />
        </div>
      )}

      {/* Admin Panel: date/hours step */}
      {adminStep === "setup" && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4">
          <div className="w-full max-w-sm animate-fade-in rounded-2xl border border-white/10 bg-black p-6 sm:p-8">
            <h3 className="mb-4 text-lg font-semibold text-white">Scanner Setup</h3>

            <div className="mb-4">
              <label className="mb-2 block text-xs font-medium text-white/40">
                Date
              </label>
              <input
                type="date"
                value={adminDate}
                onChange={(e) => setAdminDate(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-base text-white outline-none focus:border-white/40"
              />
            </div>

            <div className="mb-6">
              <label className="mb-2 block text-xs font-medium text-white/40">
                Working Hours
              </label>
              <input
                type="number"
                value={adminHours}
                onChange={(e) => setAdminHours(e.target.value)}
                min="0"
                step="0.5"
                className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-base text-white outline-none focus:border-white/40"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setAdminStep("closed")}
                className="flex-1 rounded-xl border border-white/10 py-3 text-sm font-semibold text-white/70 active:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!adminDate || !adminHours) return;
                  localStorage.setItem("attendance_date", adminDate);
                  localStorage.setItem("attendance_hours", adminHours);
                  router.push("/scanner");
                }}
                className="flex-1 rounded-xl bg-white py-3 text-sm font-semibold text-black active:opacity-80"
              >
                Start Scanner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <button
        onClick={openAdminPanel}
        className="mt-8 rounded-xl border border-white/15 px-6 py-3 text-sm font-semibold text-white/70 active:bg-white/10"
      >
        Admin
      </button>
      <p className="mt-4 text-xs text-white/20">
        Amrita Vishwa Vidyapeetham
      </p>

      {/* QR Modal */}
      <QRModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        qrImageBase64={qrImageBase64}
        rollNumber={rollNumber}
      />
    </main>
  );
}
