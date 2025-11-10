// src/components/auth/ResetPassword.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import Swal from "sweetalert2";
import LoginHeader from "../common/LoginHeader.jsx";
import LoginFooter from "../common/LoginFooter.jsx";
import { auth } from "../../config/firebase";
import { verifyPasswordResetCode, confirmPasswordReset } from "firebase/auth";

const MAROON = "#6A0F14";

// --- password rule helpers ---
const rules = {
  length: (v) => v.length >= 8, // min length (set to 8)
  lower: (v) => /[a-z]/.test(v),
  upper: (v) => /[A-Z]/.test(v),
  number: (v) => /\d/.test(v),
  special: (v) => /[^A-Za-z0-9\s]/.test(v), // any non-alnum (excluding space)
};
const fullPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,}$/;

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const qs = useQuery();

  const [status, setStatus] = useState("loading"); // loading | ready | invalid
  const [email, setEmail] = useState("");
  const [oobCode, setOobCode] = useState("");

  const [pwd, setPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  // derived validation state
  const checks = {
    length: rules.length(pwd),
    lower: rules.lower(pwd),
    upper: rules.upper(pwd),
    number: rules.number(pwd),
    special: rules.special(pwd),
  };
  const isValid = fullPattern.test(pwd);

  useEffect(() => {
    const mode = qs.get("mode");
    const code = qs.get("oobCode");

    if (mode !== "resetPassword" || !code) {
      setStatus("invalid");
      return;
    }

    setOobCode(code);
    verifyPasswordResetCode(auth, code)
      .then((emailFromCode) => {
        setEmail(emailFromCode || "");
        setStatus("ready");
      })
      .catch((e) => {
        console.error(e);
        setStatus("invalid");
      });
  }, [qs]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!isValid) return;

    try {
      Swal.fire({
        title: "Updating password…",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      await confirmPasswordReset(auth, oobCode, pwd);

      Swal.close();
      await Swal.fire({
        icon: "success",
        title: "Password updated",
        text: "You can now sign in with your new password.",
        confirmButtonColor: MAROON,
      });
      navigate("/login", { replace: true });
    } catch (err) {
      Swal.close();
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Reset failed",
        text:
          err?.code === "auth/expired-action-code"
            ? "This link has expired. Please request a new reset email."
            : "Could not reset password. Please request a new link.",
        confirmButtonColor: MAROON,
      });
    }
  };

  const item = (ok, label) => (
    <li className={`text-sm ${ok ? "text-green-600" : "text-neutral-500"}`}>
      {ok ? "✓" : "•"} {label}
    </li>
  );

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <LoginHeader />

      <div className="flex-1 grid place-items-center px-6 py-10">
        <div className="w-full max-w-lg bg-white border border-neutral-200 rounded-2xl shadow-lg p-8 md:p-10">
          <h1 className="text-2xl md:text-3xl font-bold text-neutral-800">
            Reset your password
          </h1>
          <div
            className="h-[2px] w-full mt-3"
            style={{ backgroundColor: MAROON }}
          />

          {status === "loading" && (
            <p className="mt-6 text-sm text-neutral-600">Validating link…</p>
          )}

          {status === "invalid" && (
            <div className="mt-6">
              <p className="text-sm text-red-600">
                This reset link is invalid or expired. Please request a new one.
              </p>
              <div className="text-sm mt-4">
                <Link
                  to="/forgot-password"
                  className="text-[#6A0F14] hover:underline"
                >
                  ← Back to Forgot Password
                </Link>
              </div>
            </div>
          )}

          {status === "ready" && (
            <form onSubmit={onSubmit} className="mt-6 space-y-5">
              <p className="text-sm text-neutral-600">
                Resetting password for <strong>{email}</strong>
              </p>

              <div>
                <label className="block text-sm font-medium text-neutral-700">
                  New Password
                </label>
                <div className="mt-1 relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    value={pwd}
                    onChange={(e) => setPwd(e.target.value)}
                    placeholder="Enter new password"
                    className={
                      "w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6A0F14]/50 " +
                      (pwd && !isValid
                        ? "border-red-400"
                        : "border-neutral-300")
                    }
                    // HTML-level hint (not relied on, we show our own UI)
                    pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,}"
                    title="At least 8 characters, including upper, lower, number, and special character."
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-neutral-600"
                    title={showPwd ? "Hide" : "Show"}
                  >
                    {showPwd ? "Hide" : "Show"}
                  </button>
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  Minimum <strong>8</strong> characters.
                </p>

                {/* live checklist */}
                <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                  {item(checks.length, "At least 8 characters")}
                  {item(checks.upper, "At least 1 uppercase letter")}
                  {item(checks.lower, "At least 1 lowercase letter")}
                  {item(checks.number, "At least 1 number")}
                  {item(checks.special, "At least 1 special character")}
                </ul>
              </div>

              <button
                type="submit"
                disabled={!isValid}
                className="mt-2 w-full rounded-full px-6 py-3 text-white font-medium hover:opacity-95 active:scale-[.99] bg-[#6A0F14] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save New Password
              </button>

              <div className="text-sm mt-4">
                <Link to="/login" className="text-[#6A0F14] hover:underline">
                  ← Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>

      <LoginFooter />
    </div>
  );
}
