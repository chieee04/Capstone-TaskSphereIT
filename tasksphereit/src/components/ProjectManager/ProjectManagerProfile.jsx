// src/components/CapstoneInstructor/InstructorProfile.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import { db } from "../../config/firebase";
import { supabase } from "../../config/supabase";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  limit,
  getDocs,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { Loader2, Edit3 } from "lucide-react"; // removed Shield
import Swal from "sweetalert2";

// Removed RoleTransferDialog import
import ChangePasswordDialog from "../CapstoneInstructor/ChangePassword";

const MAROON = "#6A0F14";
const isNone = (v) => !v || String(v).toLowerCase() === "none";
const safeKeyFromEmail = (email) =>
  (email || "").replace(/[^a-zA-Z0-9._-]/g, "_");

const nameWithMiddleInitial = (
  firstName = "",
  middleName = "",
  lastName = ""
) => {
  const mi =
    middleName && middleName.trim().length > 0
      ? ` ${middleName.trim()[0].toUpperCase()}.`
      : "";
  return `${(firstName || "").trim()}${mi} ${(lastName || "").trim()}`.trim();
};
const initialsOf = (firstName = "", middleName = "", lastName = "") => {
  const f = firstName?.trim()?.[0] || "";
  const m = middleName?.trim()?.[0] || "";
  const l = lastName?.trim()?.[0] || "";
  return `${f}${l || m}`.toUpperCase();
};
const Field = ({ label, children }) => (
  <div className="flex items-start gap-3">
    <div className="w-36 shrink-0 text-sm text-neutral-600">{label}</div>
    <div className="text-sm text-neutral-900">{children}</div>
  </div>
);

export default function ProjectManagerProfile() {
  const [loading, setLoading] = useState(true);
  const [userDoc, setUserDoc] = useState(null);
  const [error, setError] = useState("");

  // Removed openRoleDialog state
  const [openChangePw, setOpenChangePw] = useState(false);

  // edit + avatar
  const [editMode, setEditMode] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [removePending, setRemovePending] = useState(false);
  const fileInputRef = useRef(null);

  // Only email needs to be editable now, but keep structure for future
  const [form, setForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
  });

  // fetch user (unchanged)
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const uid = localStorage.getItem("uid");
        if (!uid) throw new Error("No UID found in localStorage.");
        let data = null;

        const directRef = doc(db, "users", uid);
        const directSnap = await getDoc(directRef);
        if (directSnap.exists()) {
          data = { id: directSnap.id, ...directSnap.data() };
        } else {
          const q = query(
            collection(db, "users"),
            where("uid", "==", uid),
            limit(1)
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            const d = snap.docs[0];
            data = { id: d.id, ...d.data() };
          }
        }

        if (!alive) return;
        if (!data) setError("Instructor not found in users collection.");
        setUserDoc(data);
      } catch (e) {
        if (!alive) return;
        console.error(e);
        setError(e.message || "Failed to load instructor.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const fullName = useMemo(
    () =>
      userDoc
        ? nameWithMiddleInitial(
            userDoc.firstName,
            userDoc.middleName,
            userDoc.lastName
          )
        : "",
    [userDoc]
  );
  const initials = useMemo(
    () =>
      userDoc
        ? initialsOf(userDoc.firstName, userDoc.middleName, userDoc.lastName)
        : "U",
    [userDoc]
  );

  // avatar src: preview > imageUrl > none
  const avatarSrc = useMemo(() => {
    if (avatarPreview) return avatarPreview;
    if (removePending) return ""; // show initials if marked for removal
    if (userDoc && !isNone(userDoc.imageUrl)) return userDoc.imageUrl;
    return "";
  }, [avatarPreview, userDoc, removePending]);

  // avatar handlers
  const handlePickFile = () => fileInputRef.current?.click();
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/png", "image/jpeg"];
    if (!allowed.includes(file.type)) {
      Swal.fire({
        icon: "error",
        title: "Invalid file type",
        text: "Please upload a PNG or JPG/JPEG image.",
      });
      e.target.value = "";
      return;
    }
    const max = 5 * 1024 * 1024;
    if (file.size > max) {
      Swal.fire({
        icon: "warning",
        title: "File too large",
        text: "Maximum file size is 5 MB.",
      });
      e.target.value = "";
      return;
    }
    setRemovePending(false); // choosing a new file cancels removal
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  // edit flow
  const startEdit = () => {
    if (!userDoc) return;
    setForm({
      // keep names for display, but they stay read-only in UI
      firstName: userDoc.firstName || "",
      middleName: userDoc.middleName || "",
      lastName: userDoc.lastName || "",
      email: userDoc.email || "",
    });
    setRemovePending(false);
    setEditMode(true);
  };
  const cancelEdit = () => {
    setEditMode(false);
    setAvatarFile(null);
    setAvatarPreview("");
    setRemovePending(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // mark photo for removal (delete happens on Save)
  const markRemove = () => {
    setRemovePending(true);
    setAvatarFile(null);
    setAvatarPreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const saveEdit = async () => {
    if (!userDoc?.id) return;

    const email = form.email.trim();
    if (!email) {
      Swal.fire({
        icon: "error",
        title: "Missing email",
        text: "Email is required.",
      });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Swal.fire({
        icon: "error",
        title: "Invalid email",
        text: "Please enter a valid email address.",
      });
      return;
    }

    Swal.fire({
      title: "Saving…",
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      timer: 1500,
      didOpen: () => Swal.showLoading(),
    });

    try {
      let imageUrl = userDoc.imageUrl || "None";

      // If removal is pending and there is an existing image, delete it
      if (removePending && !isNone(userDoc.imageUrl) && userDoc.email) {
        const keyToDelete = safeKeyFromEmail(userDoc.email); // delete by current stored email key
        await supabase.storage
          .from("user-images")
          .remove([keyToDelete])
          .catch(() => {});
        imageUrl = "None";
      }

      // Update Firestore — ONLY email + imageUrl + updatedAt
      await updateDoc(doc(db, "users", userDoc.id), {
        email,
        imageUrl,
        updatedAt: serverTimestamp(),
      });

      setUserDoc({
        ...userDoc,
        email,
        imageUrl,
      });
      setEditMode(false);
      setAvatarFile(null);
      setAvatarPreview("");
      setRemovePending(false);
      if (fileInputRef.current) fileInputRef.current.value = "";

      Swal.close();
    } catch (e) {
      console.error(e);
      Swal.close();
      Swal.fire({
        icon: "error",
        title: "Save failed",
        text: e.message || "Could not update profile.",
      });
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="rounded-2xl border border-neutral-200 bg-white shadow-[0_6px_18px_rgba(0,0,0,0.05)]">
        <div
          className="h-[6px] w-full rounded-t-2xl"
          style={{ backgroundColor: MAROON }}
        />
        <div className="p-6">
          {/* Top */}
          <div className="flex items-center gap-5">
            <div className="relative">
              <div
                className="h-14 w-14 rounded-full flex items-center justify-center text-white text-lg font-semibold shadow overflow-hidden"
                style={{ backgroundColor: MAROON }}
                title="Instructor avatar"
              >
                {loading ? (
                  <Loader2 className="animate-spin w-5 h-5 text-white" />
                ) : avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt="avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>

              {editMode && (
                <button
                  type="button"
                  onClick={handlePickFile}
                  className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full border border-neutral-200 bg-white hover:bg-neutral-50 shadow flex items-center justify-center"
                  title="Change avatar"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <div>
              {loading ? (
                <div className="mt-1 h-6 w-48 bg-neutral-200/70 rounded animate-pulse" />
              ) : error ? (
                <div className="mt-1 text-red-600 text-[15px]">{error}</div>
              ) : (
                <h1 className="text-[20px] font-semibold text-neutral-900">
                  {fullName}
                </h1>
              )}
              <div className="text-sm text-neutral-500">Project Manager</div>
            </div>
          </div>

          <div className="my-5 h-px bg-neutral-200" />

          {/* Details */}
          {loading ? (
            <div className="space-y-3">
              <div className="h-4 w-3/5 bg-neutral-200/70 rounded animate-pulse" />
              <div className="h-4 w-2/5 bg-neutral-200/70 rounded animate-pulse" />
              <div className="h-4 w-1/2 bg-neutral-200/70 rounded animate-pulse" />
            </div>
          ) : !error && userDoc ? (
            <div className="space-y-3">
              <Field label="Full Name">
                <span className="font-medium">{fullName}</span>
              </Field>

              {/* Names are always read-only now */}
              <Field label="First Name">{userDoc.firstName || "-"}</Field>

              <Field label="Middle Initial">
                {userDoc.middleName
                  ? `${(userDoc.middleName[0] || "").toUpperCase()}.`
                  : "-"}
              </Field>

              <Field label="Last Name">{userDoc.lastName || "-"}</Field>

              {/* Only Email is editable when in edit mode */}
              <Field label="Email">
                {!editMode ? (
                  userDoc.email || "-"
                ) : (
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, email: e.target.value }))
                    }
                    className="w-80 rounded-md border border-neutral-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
                  />
                )}
              </Field>

              {userDoc.role && <Field label="Role">{userDoc.role}</Field>}
              {userDoc.idNo && <Field label="ID No">{userDoc.idNo}</Field>}
            </div>
          ) : null}

          {/* Actions */}
          <div className="mt-6 flex flex-wrap gap-3 justify-end">
            {!editMode ? (
              <>
                <button
                  type="button"
                  onClick={startEdit}
                  className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold border border-neutral-300 bg-white hover:bg-neutral-50"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setOpenChangePw(true)}
                  className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold border border-neutral-300 bg-white hover:bg-neutral-50"
                >
                  Change Password
                </button>
                {/* Removed "Turn over of data" button */}
              </>
            ) : (
              <>
                {/* Remove Photo (marks for removal; actual delete on Save) */}
                <button
                  type="button"
                  onClick={markRemove}
                  className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold border border-neutral-300 bg-white hover:bg-neutral-50"
                >
                  Remove Photo
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold border border-neutral-300 bg-white hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm"
                  style={{ backgroundColor: MAROON }}
                >
                  Save
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Removed RoleTransferDialog section */}
      {openChangePw && (
        <ChangePasswordDialog onClose={() => setOpenChangePw(false)} />
      )}
    </div>
  );
}