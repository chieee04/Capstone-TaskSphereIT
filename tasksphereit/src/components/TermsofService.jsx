// src/components/TermsofService.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../config/firebase";
import {
  collection,
  query,
  where,
  limit,
  getDocs,
  doc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

const MAROON = "#6A0F14";
const TOS_VERSION = "2025-05-09"; // bump to force re-consent after edits

export default function TermsofService() {
  const navigate = useNavigate();
  const loc = useLocation();

  const [uid, setUid] = useState(null);
  const [docId, setDocId] = useState(null);
  const [role, setRole] = useState(null);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);
  const fromRoute = useMemo(() => loc.state?.from ?? null, [loc.state]);

  const unsubRef = useRef(null);

  const routeForRole = (r) => {
    if (r === "Adviser") return "/adviser/dashboard";
    if (r === "Member") return "/member/dashboard";
    if (r === "Project Manager") return "/projectmanager/dashboard";
    return "/instructor/dashboard";
  };

  // watch auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return () => unsub();
  }, []);

  // resolve user doc & LIVE subscribe so UI updates immediately after Accept
  useEffect(() => {
    (async () => {
      if (!uid) {
        setShow(false);
        setLoading(false);
        return;
      }

      const usersRef = collection(db, "users");
      const byUid = query(usersRef, where("uid", "==", uid), limit(1));
      const snap = await getDocs(byUid);

      if (snap.empty) {
        await signOut(auth);
        navigate("/login", { replace: true });
        return;
      }

      const d = snap.docs[0];
      setDocId(d.id);
      setRole(d.data()?.role || null);

      // clean previous listener if any
      if (unsubRef.current) unsubRef.current();

      unsubRef.current = onSnapshot(doc(db, "users", d.id), async (ds) => {
        const data = ds.data() || {};

        // ensure the boolean exists (default false)
        if (typeof data.isTosAccepted !== "boolean") {
          await updateDoc(ds.ref, {
            isTosAccepted: false,
            tosVersion: null,
            tosAcceptedAt: null,
            updatedAt: serverTimestamp(),
          });
          return;
        }

        const accepted = data.isTosAccepted === true;

        if (accepted) {
          setShow(false);
          // if we're sitting on /terms-of-service, bounce to where we came from or role default
          if (loc.pathname === "/terms-of-service") {
            navigate(fromRoute || routeForRole(data.role), { replace: true });
          }
        } else {
          setShow(true);
        }

        setLoading(false);
      });
    })();

    return () => {
      if (unsubRef.current) unsubRef.current();
    };
    // re-evaluate when auth changes or route changes
  }, [uid, loc.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const accept = async () => {
    if (!docId) return;
    try {
      await updateDoc(doc(db, "users", docId), {
        isTosAccepted: true,
        tosVersion: TOS_VERSION,
        tosAcceptedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      // make it vanish immediately (listener will also confirm)
      setShow(false);
      navigate(fromRoute || routeForRole(role), { replace: true });
    } catch (e) {
      console.error("Accept TOS error:", e);
    }
  };

  const decline = async () => {
    try {
      await signOut(auth);
    } finally {
      navigate("/login", { replace: true });
    }
  };

  if (!show || loading) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tos-title"
    >
      <div className="bg-white w-[min(960px,92vw)] max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4" style={{ backgroundColor: MAROON }}>
          <h2 id="tos-title" className="text-white text-xl font-semibold">Terms of Service</h2>
          <p className="text-white/90 text-xs">
            Effective Date: May 09, 2025 • TaskSphere IT • tasksphereit@gmail.com • Capas, Tarlac, Philippines
          </p>
        </div>

        {/* Body (scrollable) */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-sm leading-6">
          {[
            ["1. Acceptance of Terms",
              "By using TaskSphere IT, you agree to abide by these Terms of Service. If you do not agree to any part, you are not authorized to use the system."],
            ["2. User Roles and Responsibilities",
              <>
                Users are assigned specific roles within the system:
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li><b>Capstone Instructor:</b> Full administrative control over users, schedules, and team assignments.</li>
                  <li><b>Capstone Adviser:</b> Guides teams, assigns and monitors tasks, and reviews progress.</li>
                  <li><b>Project Manager:</b> Assigns tasks to members, tracks progress, and oversees team deliverables.</li>
                  <li><b>Member:</b> Completes tasks assigned by Project Managers and Advisers.</li>
                  <li><b>Solo User:</b> Works independently on tasks without a team.</li>
                </ul>
                <p className="mt-3">All users are expected to use the system ethically and responsibly.</p>
              </>],
            ["3. Account Security",
              "You are responsible for safeguarding your login credentials. Report any unauthorized use immediately to your Capstone Instructor."],
            ["4. Privacy and Data Protection",
              "TaskSphere IT collects and stores data relevant to academic and task progress. Data is managed securely and used solely for system functionality."],
            ["5. Prohibited Activities",
              "Do not tamper with functionalities; use the system for illegal/unauthorized purposes; upload malicious/offensive content; or misrepresent roles or academic data."],
            ["6. Intellectual Property",
              "All system content (templates, UI, schedules, software) is TaskSphere IT property. Access is limited to educational use; copying or repurposing is prohibited."],
            ["7. System Access and Termination",
              "Accounts may be suspended/terminated for violations, abuse, or compromising security/academic integrity."],
            ["8. Changes to Terms or System",
              "TaskSphere IT may modify these Terms at any time. Notice will be provided in-system or via email. Continued use indicates acceptance."],
            ["9. Limitation of Liability",
              "Provided “as is” without warranties; not liable for losses due to misuse, outages, or user error."],
            ["10. Indemnification",
              "You agree to hold harmless TaskSphere IT, its developers, instructors, and affiliates from claims/damages from misuse or breach."],
            ["11. Governing Law and Dispute Resolution",
              "Republic of the Philippines; courts in Capas, Tarlac."],
            ["12. Contact Information",
              "Email: tasksphereit@gmail.com • Location: Capas, Tarlac, Philippines"],
          ].map(([title, content], i) => (
            <section key={i}>
              <div className="font-semibold text-neutral-900">{title}</div>
              <div className="text-neutral-700">{content}</div>
              {i < 11 && <hr className="my-4 border-neutral-200" />}
            </section>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-neutral-50 flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={decline}
            className="px-4 py-2 rounded-lg border border-neutral-300 text-neutral-700 hover:bg-neutral-100 cursor-pointer"
          >
            Decline
          </button>
          <button
            onClick={accept}
            className="px-4 py-2 rounded-lg text-white hover:opacity-95 cursor-pointer"
            style={{ backgroundColor: MAROON }}
          >
            I Accept
          </button>
        </div>
      </div>
    </div>
  );
}
