// src/components/ProjectManager/ProjectManagerTitleModal.jsx
import React, { useState } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../config/firebase";

const MAROON = "#6A0F14";

export default function ProjectManagerTitleModal({
  open = false,
  teamId,
  teamName,
  pm = null,              // { uid, name } optional
  onSaved,                // (title) => void
}) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const canSave = title.trim().length >= 3;

  const handleSave = async () => {
    if (!canSave || !teamId) return;
    setSaving(true);
    try {
      // Store in a dedicated collection keyed by teamId (easy to query later)
      // Collection name: teamSystemTitles
      await setDoc(doc(db, "teamSystemTitles", teamId), {
        teamId,
        teamName: teamName || null,
        systemTitle: title.trim(),
        createdBy: pm ? { uid: pm.uid || null, name: pm.name || "Project Manager" } : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      onSaved?.(title.trim());
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] max-w-[92vw]">
        <div className="rounded-2xl bg-white border border-neutral-200 shadow-2xl">
          {/* Header */}
          <div className="px-6 pt-5 pb-3">
            <div className="text-[18px] font-semibold" style={{ color: MAROON }}>
              Team Title
            </div>
            <div className="mt-2 h-[2px] w-full" style={{ backgroundColor: MAROON }} />
          </div>

          {/* Body */}
          <div className="px-6 pb-6 space-y-4">
            <p className="text-sm text-neutral-800 leading-relaxed">
              Please enter your Capstone Title before proceeding. This information is
              required to continue. You can only proceed once a title is provided so that
              your Capstone Instructor and Capstone Adviser are aware of your system.
            </p>

            <div className="mt-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-300"
                placeholder="Enter system title"
              />
              <div className="mt-1 text-[11px] text-neutral-500">
                {teamName ? `Team: ${teamName}` : null}
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={handleSave}
                disabled={!canSave || saving}
                className={`inline-flex items-center justify-center rounded-md px-5 py-2 text-sm font-semibold text-white ${!canSave || saving ? "opacity-60 cursor-not-allowed" : ""}`}
                style={{ backgroundColor: MAROON }}
              >
                {saving ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
