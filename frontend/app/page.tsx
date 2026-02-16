"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateQR } from "@/services/api";
import QRModal from "@/components/QRModal";

export default function Home() {
  const router = useRouter();
  const [rollNumber, setRollNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [qrImageBase64, setQrImageBase64] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    setError("");

    // Client-side validation
    const trimmed = rollNumber.trim();
    // Check for admin redirection
    if (trimmed.toLowerCase() === "bhargi") {
      router.push("/scanner");
      return;
    }
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
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black px-4">
      {/* Background gradient orbs */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-[#e94560]/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-[#533483]/20 blur-[120px]" />

      {/* Card */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-8 shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
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
            className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/50"
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
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-all duration-200 focus:border-[#e94560]/50 focus:bg-white/[0.06] focus:ring-2 focus:ring-[#e94560]/20"
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
          className="relative flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#e94560] to-[#c23152] px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:scale-[1.02] hover:shadow-xl active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
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

      {/* Footer */}
      <p className="mt-8 text-xs text-white/20">
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
