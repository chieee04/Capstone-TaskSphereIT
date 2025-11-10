import React, { useState } from "react";
import { auth, db } from "../../config/firebase"; // <-- make sure db is imported
import { updatePassword } from "firebase/auth";
import { collection, query, where, getDocs, updateDoc } from "firebase/firestore";
// <-- import for Firestore update
import { Eye, EyeOff, X, Loader2 } from "lucide-react";

const MAROON = "#6A0F14";

export default function ChangePasswordDialog({ onClose }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleUpdate = async () => {
  setErr("");
  setOk("");

  if (!pw || !pw2) return setErr("Please fill both fields.");
  if (pw !== pw2) return setErr("Passwords do not match.");
  if (pw.length < 6) return setErr("Password should be at least 6 characters.");

  try {
    setSubmitting(true);
    const user = auth.currentUser;
    if (!user) throw new Error("No signed-in user.");

    // 1️⃣ Update password in Firebase Auth
    await updatePassword(user, pw);

    // 2️⃣ Find the Firestore doc by uid
    const q = query(collection(db, "users"), where("uid", "==", user.uid));
    const snap = await getDocs(q);

    if (!snap.empty) {
      const userDoc = snap.docs[0];
      await updateDoc(userDoc.ref, { mustChangePassword: false });
    } else {
      console.warn("User document not found for uid:", user.uid);
    }

    // 3️⃣ Success message + close modal
    setOk("Password updated successfully.");
    setPw("");
    setPw2("");
    setTimeout(() => {
      onClose();
    }, 1000);
  } catch (e) {
    console.error(e);
    let msg = e?.message || "Failed to update password.";
    if (e?.code === "auth/requires-recent-login") {
      msg =
        "For security, please sign out and sign in again, then retry updating the password.";
    }
    setErr(msg);
  } finally {
    setSubmitting(false);
  }
};


  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      {/* Centered Panel */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-[520px] max-w-[95vw] rounded-2xl bg-white border border-neutral-200 shadow-2xl">
          {/* Header */}
          <div className="px-6 pt-5 pb-3">
            <div className="flex items-center justify-between">
              <div className="text-[16px] font-semibold" style={{ color: MAROON }}>
                Change Password
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-md hover:bg-neutral-100"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-neutral-600" />
              </button>
            </div>
            <div className="mt-3 h-[2px] w-full bg-neutral-200">
              <div className="h-[2px]" style={{ backgroundColor: MAROON, width: 150 }} />
            </div>
          </div>

          {/* Body */}
          <div className="px-6 pb-6">
            <div className="space-y-4">
              {/* New Password */}
              <div>
                <label className="block text-sm text-neutral-700 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={show1 ? "text" : "password"}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm pr-10"
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-2.5 p-1 rounded hover:bg-neutral-100"
                    onClick={() => setShow1((s) => !s)}
                    aria-label={show1 ? "Hide password" : "Show password"}
                  >
                    {show1 ? (
                      <EyeOff className="w-4 h-4 text-neutral-600" />
                    ) : (
                      <Eye className="w-4 h-4 text-neutral-600" />
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm text-neutral-700 mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={show2 ? "text" : "password"}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm pr-10"
                    value={pw2}
                    onChange={(e) => setPw2(e.target.value)}
                    placeholder="Re-enter new password"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-2.5 p-1 rounded hover:bg-neutral-100"
                    onClick={() => setShow2((s) => !s)}
                    aria-label={show2 ? "Hide password" : "Show password"}
                  >
                    {show2 ? (
                      <EyeOff className="w-4 h-4 text-neutral-600" />
                    ) : (
                      <Eye className="w-4 h-4 text-neutral-600" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Alerts */}
            {err && <div className="mt-3 text-sm text-red-600">{err}</div>}
            {ok && <div className="mt-3 text-sm text-green-700">{ok}</div>}

            {/* Footer */}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={submitting}
                className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white ${
                  submitting ? "opacity-60" : ""
                }`}
                style={{ backgroundColor: MAROON }}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Update Password"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
