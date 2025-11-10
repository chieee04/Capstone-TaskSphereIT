// src/components/auth/ForgotPassword.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import LoginHeader from "../common/LoginHeader.jsx";
import LoginFooter from "../common/LoginFooter.jsx";
import Swal from "sweetalert2";

// Firebase
import { auth, db } from "../../config/firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import { collection, query, where, getDocs, limit } from "firebase/firestore";

const maroon = "#6A0F14";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");

  // Firestore validation state
  const [checking, setChecking] = useState(false);
  const [emailOk, setEmailOk] = useState(null); // null | true | false
  const [emailStatus, setEmailStatus] = useState("");

  // Store full name for display (kept, but optional)
  const [fullName, setFullName] = useState("");

  // ====== Submit email and send Firebase reset link ======
  const submitEmail = async (e) => {
    e.preventDefault();
    setErr("");

    const v = email.trim().toLowerCase();
    if (!v) {
      setErr("Please enter your email.");
      return;
    }
    if (!emailOk) {
      setErr("Please enter a valid instructor email.");
      return;
    }

    Swal.fire({
      title: "Sending Reset Link...",
      text: "Please wait while we send the password reset email.",
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      // IMPORTANT: handle in app + custom page
      await sendPasswordResetEmail(auth, v, {
        url: `${window.location.origin}/reset-password`,
        handleCodeInApp: true,
      });

      Swal.close();
      await Swal.fire({
        icon: "success",
        title: "Email Sent!",
        html: `
          <p>A password reset link has been sent to <strong>${v}</strong>.</p>
          <p class="text-sm text-neutral-600 mt-2">Check your inbox and click the link to reset your password.</p>
        `,
        confirmButtonColor: maroon,
        confirmButtonText: "Back to Sign In",
      });

      navigate("/login", { replace: true });
    } catch (error) {
      Swal.close();
      console.error("Password reset error:", error);

      let errorMessage = "Something went wrong. Please try again.";
      switch (error?.code) {
        case "auth/user-not-found":
          errorMessage = "No account found with this email.";
          break;
        case "auth/invalid-email":
          errorMessage = "Invalid email address.";
          break;
        case "auth/too-many-requests":
          errorMessage = "Too many attempts. Please try again later.";
          break;
        case "auth/invalid-continue-uri":
          errorMessage = "The redirect URL is invalid.";
          break;
        case "auth/unauthorized-continue-uri":
          errorMessage = "The redirect URL is not in Authorized domains.";
          break;
        default:
          errorMessage = error?.message || errorMessage;
      }

      await Swal.fire({
        icon: "error",
        title: "Failed to Send Email",
        text: errorMessage,
        confirmButtonColor: maroon,
      });
      setErr(errorMessage);
    }
  };

  // 🔹 Debounced Firestore check for Instructor email
  useEffect(() => {
    const v = email.trim().toLowerCase();
    setEmailOk(null);
    setEmailStatus("");
    setErr("");

    if (!v) return;

    const t = setTimeout(async () => {
      try {
        setChecking(true);
        const q = query(
          collection(db, "users"),
          where("email", "==", v),
          limit(1)
        );
        const snap = await getDocs(q);

        if (!snap.empty) {
          const data = snap.docs[0].data() || {};
          const role = (data?.role || "").toString();
          const first = (data.firstName || "").trim();
          const middle = (data.middleName || "").trim();
          const last = (data.lastName || "").trim();
          const mi = middle ? `${middle[0].toUpperCase()}.` : "";
          const name = [first, mi, last].filter(Boolean).join(" ").trim();

          // Loosen check if you store variants like "Capstone Instructor"
          if (role.toLowerCase().includes("instructor")) {
            setEmailOk(true);
            setEmailStatus(
              name ? `Instructor: ${name}` : "Instructor: (name unavailable)"
            );
            setFullName(name || "Instructor");
          } else {
            setEmailOk(false);
            setEmailStatus(
              "This is not the Capstone Instructor email. Contact the Capstone Instructor to change your password."
            );
          }
        } else {
          setEmailOk(false);
          setEmailStatus(
            "This is not the Capstone Instructor email. Contact the Capstone Instructor to change your password."
          );
        }
      } catch (error) {
        console.error("Email verification error:", error);
        setEmailOk(false);
        setEmailStatus("Could not verify email right now. Try again.");
      } finally {
        setChecking(false);
      }
    }, 400);

    return () => clearTimeout(t);
  }, [email]);

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
            style={{ backgroundColor: maroon }}
          />

          <form onSubmit={submitEmail} className="mt-6 space-y-5">
            <p className="text-sm text-neutral-600">
              Enter your instructor account email and we'll send you a link to
              reset your password.
            </p>

            <div>
              <label className="block text-sm font-medium text-neutral-700">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6A0F14]/50"
              />
              {checking && (
                <p className="mt-1 text-xs text-neutral-500">Checking…</p>
              )}
              {!checking && emailOk === true && (
                <p className="mt-1 text-xs text-green-600">{emailStatus}</p>
              )}
              {!checking && emailOk === false && (
                <p className="mt-1 text-xs text-red-600">{emailStatus}</p>
              )}
            </div>

            {err && <p className="text-sm text-red-600">{err}</p>}

            <button
              type="submit"
              disabled={!emailOk}
              className="mt-2 w-full rounded-full px-6 py-3 text-white font-medium hover:opacity-95 active:scale-[.99] bg-[#6A0F14] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send Reset Link
            </button>

            <div className="text-sm mt-4">
              <Link to="/login" className="text-[#6A0F14] hover:underline">
                ← Back to Sign In
              </Link>
            </div>
          </form>

          <div className="mt-6 p-4 bg-neutral-50 border border-neutral-200 rounded-lg">
            <p className="text-xs text-neutral-600">
              <strong>Note:</strong> The reset link will expire after 1 hour.
              Check your spam folder if you don't see the email within a few
              minutes.
            </p>
          </div>
        </div>
      </div>

      <LoginFooter />
    </div>
  );
}
