import React, { useState } from "react";
import { db, auth } from "../../config/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { User, Loader2, ArrowRight, X } from "lucide-react";
import Swal from "sweetalert2";
import { sendLoginEmail } from "../../assets/scripts/email";

const MAROON = "#6A0F14";
const DEFAULT_PASSWORD = "UserUser321"; // default password for new user

export default function RoleTransferDialog({
  currentName,
  currentIdNo,
  currentEmail,
  onClose,
}) {
  const [form, setForm] = useState({
    lastName: "",
    firstName: "",
    middleName: "",
    idNo: "",
    email: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // ===== Validators =====
  const isDigits = (v) => /^\d+$/.test(v || "");
  const isNonEmpty = (v) => (v || "").trim().length > 0;
  const isGmail = (v) =>
    /^[A-Za-z0-9._%+-]+@gmail\.com$/i.test((v || "").trim());

  const errors = {
    lastName: !isNonEmpty(form.lastName) ? "Last name is required." : "",
    firstName: !isNonEmpty(form.firstName) ? "First name is required." : "",
    idNo: !isNonEmpty(form.idNo)
      ? "ID No is required."
      : !isDigits(form.idNo)
      ? "ID No must contain digits only."
      : "",
    email: !isNonEmpty(form.email)
      ? "Email is required."
      : !isGmail(form.email)
      ? "Email must be a valid @gmail.com address."
      : "",
  };
  const formValid = Object.values(errors).every((e) => e === "");

  const handleEnroll = async () => {
    setSubmitting(true);
    setErr("");
    setOk("");

    try {
      if (!formValid) throw new Error("Please fix the highlighted fields.");

      const email = form.email.trim().toLowerCase();
      const firstName = form.firstName.trim();
      const middleName = (form.middleName || "").trim();
      const lastName = form.lastName.trim();
      const idNo = (form.idNo || "").trim();

      // Create the user in Firebase Auth with a default password
      const cred = await createUserWithEmailAndPassword(
        auth,
        email,
        DEFAULT_PASSWORD
      );
      const newUid = cred.user.uid;

      // Save the instructor data in Firestore with `activate: false`
      await setDoc(doc(db, "users", newUid), {
        uid: newUid,
        email,
        firstName,
        middleName,
        lastName,
        idNumber: idNo,
        role: "Instructor",
        activate: "inactive",
        imageUrl: "None",
        updatedAt: serverTimestamp(),
        mustChangePassword: true,
        forceDefaultPassword: true,
        isTosAccepted: false,
        tosAcceptedAt: serverTimestamp(),
        tosVersion: "2025-05-09",
      });

      // Display success message
      setOk("New instructor enrolled successfully, but account is inactive.");

      // Trigger SweetAlert loading and then send email
      Swal.fire({
        title: "Sending invitation email...",
        didOpen: () => {
          Swal.showLoading();
        },
        allowOutsideClick: false,
      });

      // Create full name format "FirstName M. LastName"
      const middleInitial = middleName ? `${middleName[0]}.` : "";
      const fullName = `${firstName} ${middleInitial} ${lastName}`;

      // Send the invitation email
      await sendLoginEmail({ email, fullName });

      // Once email is sent, show a success alert
      Swal.fire({
        icon: "success",
        title: "Invitation sent successfully!",
        text: `An invitation has been sent to ${email}.`,
      });

      onClose?.();
    } catch (e) {
  console.error(e);

  let message = "Failed to enroll the new instructor.";

  // Custom handling for specific Firebase Auth errors
  if (e.code === "auth/email-already-in-use") {
    message = "Email already used. Please use a different email address.";
  } else if (e.code === "auth/invalid-email") {
    message = "Invalid email address.";
  } else if (e.code === "auth/weak-password") {
    message = "Password is too weak.";
  } else if (e.message) {
    message = e.message;
  }

  setErr(message);

  Swal.fire({
    icon: "info",
    title: "Please Try Again",
    text: message,
  });
} finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-[760px] max-w-[95vw] rounded-2xl bg-white border border-neutral-200 shadow-2xl">
          {/* Header */}
          <div className="px-6 pt-5 pb-3">
            <div className="flex items-center justify-between">
              <div
                className="text-[16px] font-semibold"
                style={{ color: MAROON }}
              >
                Role Transfer
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
              <div
                className="h-[2px]"
                style={{ backgroundColor: MAROON, width: "100%" }}
              />
            </div>
          </div>

          {/* Body */}
          <div className="px-6 pb-6">
            <div className="rounded-xl border border-neutral-200 p-4">
              <div
                className="flex items-center gap-2 font-medium"
                style={{ color: MAROON }}
              >
                <User className="w-4 h-4" /> Current Capstone Instructor
              </div>
              <div className="mt-3 grid grid-cols-2 gap-y-2">
                <div className="text-sm text-neutral-600">Name</div>
                <div className="text-sm font-medium">{currentName || "—"}</div>
                <div className="text-sm text-neutral-600">Email</div>
                <div className="text-sm font-medium">{currentEmail || "—"}</div>
              </div>
            </div>

            <div className="my-4 h-px bg-neutral-200" />

            <div className="rounded-xl border border-neutral-200 p-4">
              <div
                className="flex items-center gap-2 font-medium"
                style={{ color: MAROON }}
              >
                <User className="w-4 h-4" /> New Capstone Instructor
              </div>

              {/* Form fields */}
              <div className="mt-3 grid grid-cols-3 gap-3">
                {/* Last Name */}
                <div>
                  <label className="block text-sm text-neutral-700 mb-1">
                    Last Name
                  </label>
                  <input
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={form.lastName}
                    onChange={(e) => setField("lastName", e.target.value)}
                  />
                </div>

                {/* First Name */}
                <div>
                  <label className="block text-sm text-neutral-700 mb-1">
                    First Name
                  </label>
                  <input
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={form.firstName}
                    onChange={(e) => setField("firstName", e.target.value)}
                  />
                </div>

                {/* Middle Name */}
                <div>
                  <label className="block text-sm text-neutral-700 mb-1">
                    Middle Name
                  </label>
                  <input
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={form.middleName}
                    onChange={(e) => setField("middleName", e.target.value)}
                  />
                </div>

                {/* ID No */}
                <div>
                  <label className="block text-sm text-neutral-700 mb-1">
                    ID NO
                  </label>
                  <input
                    inputMode="numeric"
                    pattern="\d*"
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={form.idNo}
                    onChange={(e) =>
                      setField("idNo", e.target.value.replace(/\D/g, ""))
                    }
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm text-neutral-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                  />
                </div>
              </div>

              {err && <div className="mt-3 text-sm text-red-600">{err}</div>}
              {ok && <div className="mt-3 text-sm text-green-700">{ok}</div>}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                onClick={handleEnroll}
                disabled={submitting || !formValid}
                className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white ${
                  submitting || !formValid
                    ? "opacity-60 cursor-not-allowed"
                    : ""
                }`}
                style={{ backgroundColor: MAROON }}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                Enroll (no verification email)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
