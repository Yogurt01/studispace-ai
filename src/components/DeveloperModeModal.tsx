import React, { useEffect, useRef, useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { useDeveloperMode } from "../context/DeveloperModeContext";

interface DeveloperModeModalProps {
  isOpen: boolean;
  /** Name of the model the student was trying to reach, for the explanation line. */
  modelName?: string;
  onClose: () => void;
  onUnlocked: () => void;
}

/**
 * Password prompt for Developer Mode.
 *
 * The field is a real password input, the value is held only for the duration of
 * the submit, and it is cleared on every outcome — success, failure or cancel.
 * Nothing here knows the password: the server is the only thing that can judge
 * it, so a wrong guess is an HTTP 401, not a local string comparison.
 */
export const DeveloperModeModal: React.FC<DeveloperModeModalProps> = ({ isOpen, modelName, onClose, onUnlocked }) => {
  const { unlock } = useDeveloperMode();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setPassword("");
    setError(null);
    setSubmitting(false);
    // Focus after paint so the student can just start typing.
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [isOpen]);

  // Escape closes without unlocking; the model stays locked.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting || !password) return;
    setSubmitting(true);
    setError(null);
    const result = await unlock(password);
    // Never keep the candidate around after the attempt, whatever the outcome.
    setPassword("");
    setSubmitting(false);
    if (result.ok) {
      onUnlocked();
      return;
    }
    setError(result.error || "Incorrect developer password.");
    inputRef.current?.focus();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="developer-mode-title">
      <div className="bg-white border-2 border-black max-w-md w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b-2 border-black">
          <div className="bg-[#FFE600] p-2 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <ShieldCheck className="w-5 h-5 text-black" />
          </div>
          <div>
            <h2 id="developer-mode-title" className="font-black text-xl uppercase text-black">Developer Mode</h2>
            <p className="text-xs font-bold text-gray-700">
              {modelName ? `${modelName} is restricted to developers.` : "This model is restricted to developers."}
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="font-black text-[11px] uppercase tracking-wider text-gray-700">Developer Password</span>
            <input
              id="input-developer-password"
              ref={inputRef}
              type="password"
              autoComplete="off"
              value={password}
              onChange={(event) => { setPassword(event.target.value); setError(null); }}
              className="w-full px-3 py-2.5 border-2 border-black font-bold text-sm bg-white focus:outline-none focus:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
              placeholder="••••••••••••"
            />
          </label>

          {error && (
            <p id="developer-mode-error" role="alert" className="flex items-start gap-1.5 border-2 border-black bg-[#FF3B3B] text-white font-black text-[11px] uppercase p-2.5">
              <Lock className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </p>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              id="btn-developer-cancel"
              onClick={onClose}
              className="px-4 py-2 border-2 border-black bg-white font-black text-xs uppercase hover:bg-gray-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="btn-developer-unlock"
              disabled={submitting || !password}
              className="px-5 py-2 border-2 border-black bg-[#00F0FF] font-black text-xs uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] disabled:bg-gray-200 disabled:text-gray-500 disabled:shadow-none"
            >
              {submitting ? "Checking…" : "Unlock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
