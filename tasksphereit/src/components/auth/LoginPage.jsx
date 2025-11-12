// src/components/auth/LoginPage.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import LoginHeader from "../common/LoginHeader.jsx";
import LoginFooter from "../common/LoginFooter.jsx";
import TaskSphereLogo from "../../assets/imgs/TaskSphereLogo.png";
import CCSLogo from "../../assets/imgs/ccs-logo.png";

// Firebase
import { auth, db } from "../../config/firebase";
import {
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  onAuthStateChanged, // auth guard


} from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  limit,
  doc,
  updateDoc,
} from "firebase/firestore";

const DEFAULT_PASSWORD = "UserUser321";

const LoginPage = () => {
  const [showPwd, setShowPwd] = useState(false);
  const [loginId, setLoginId] = useState(""); // Can be email OR idNumber
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const navigate = useNavigate();

  const routeForRole = (role) => {
    if (role === "Adviser") return "/adviser/dashboard";
    if (role === "Member") return "/member/dashboard";
    if (role === "Project Manager") return "/projectmanager/dashboard";
    return "/instructor/dashboard";
  };

  /* ====================== LOCK BACK NAV WHILE ON /login ====================== */
  useEffect(() => {
    // Push a state and trap back navigation to keep user on /login until they authenticate
    const trap = (ev) => {
      ev?.preventDefault?.();
      navigate("/login", { replace: true });
    };
    // Push a dummy entry to history so Back triggers popstate we can trap
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", trap);

    // If a protected page is restored from bfcache, force a reload so auth guards run
    const onShow = (e) => {
      if (e.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", onShow);

    return () => {
      window.removeEventListener("popstate", trap);
      window.removeEventListener("pageshow", onShow);
    };
  }, [navigate]);
  /* ========================================================================== */

  /* =================== GUARD: block /login when already authed ============== */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      try {
        if (!u) return;

        // find profile doc by uid
        const usersRef = collection(db, "users");
        const byUid = query(usersRef, where("uid", "==", u.uid), limit(1));
        const snap = await getDocs(byUid);

        if (snap.empty) {
          await signOut(auth);
          return;
        }

        const d = snap.docs[0];
        const data = d.data() || {};
        const role = data.role || null;

        // ensure default TOS field exists
        if (typeof data.isTosAccepted !== "boolean") {
          await updateDoc(doc(db, "users", d.id), {
            isTosAccepted: false,
            updatedAt: new Date(),
          });
        }

        // already signed-in users shouldn't see /login
        if (data.isTosAccepted === true) {
          navigate(routeForRole(role), { replace: true });
        } else {
          navigate("/terms-of-service", {
            replace: true,
            state: { from: routeForRole(role) },
          });
        }
      } catch (e) {
        console.error("Login guard error:", e);
      }
    });

    return () => unsub();
  }, [navigate]);
  /* ========================================================================== */

  const findUserByEmailOrIdNumber = async (identifier) => {
    const usersRef = collection(db, "users");
    const trimmedId = identifier.trim();

    // Try by email first
    const byEmail = query(usersRef, where("email", "==", trimmedId), limit(1));
    const emailSnap = await getDocs(byEmail);

    if (!emailSnap.empty) {
      return emailSnap.docs[0];
    }

    // Try by idNumber if email not found
    const byIdNumber = query(
      usersRef,
      where("idNumber", "==", trimmedId),
      limit(1)
    );
    const idNumberSnap = await getDocs(byIdNumber);

    if (!idNumberSnap.empty) {
      return idNumberSnap.docs[0];
    }

    return null;
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      const identifier = loginId.trim();

      if (!identifier) {
        setErr("Please enter your email or ID number.");
        setLoading(false);
        return;
      }

      // Find user profile by email OR idNumber
      const profileDoc = await findUserByEmailOrIdNumber(identifier);

      if (!profileDoc) {
        setErr("Account not found. Please check your email/ID number.");
        setLoading(false);
        return;
      }

      const profile = profileDoc.data();
      const userEmail = profile.email; // Get the actual email for Firebase Auth

      if (!userEmail) {
        setErr("Invalid account configuration. Please contact administrator.");
        setLoading(false);
        return;
      }

      // Sign in with the actual email from Firestore + provided password
      const cred = await signInWithEmailAndPassword(auth, userEmail, pwd);

      // Verify the signed-in user matches the profile we found
     if (cred.user.uid !== profile.uid) {
  // Auto-heal: update Firestore UID if email matches but UID is outdated
  await updateDoc(doc(db, "users", profileDoc.id), {
    uid: cred.user.uid,
    updatedAt: new Date(),
  });
}


      const role = profile.role || null;
      const currentActivateStatus = profile.activate;

      // hard block retired instructor accounts
      if (role === "Instructor" && currentActivateStatus === "retired") {
        await signOut(auth);
        setErr("Invalid credentials. This account is no longer active.");
        setLoading(false);
        return;
      }

      // --- ensure isTosAccepted exists (default false if missing) ---
      if (typeof profile.isTosAccepted !== "boolean") {
        await updateDoc(doc(db, "users", profileDoc.id), {
          isTosAccepted: false,
          updatedAt: new Date(),
        });
        profile.isTosAccepted = false;
      }

      // cache minimal info
      localStorage.setItem("uid", cred.user.uid);
      if (role) localStorage.setItem("role", role);

      // --- TOS gate: if not accepted yet, push to /terms-of-service and stop here ---
      if (profile.isTosAccepted !== true) {
        navigate("/terms-of-service", {
          replace: true,
          state: { from: routeForRole(role) },
        });
        setLoading(false);
        return;
      }

      // (Only for already-accepted users) optional default password enforcement
      if (profile.forceDefaultPassword) {
        await updatePassword(cred.user, DEFAULT_PASSWORD);
        await updateDoc(doc(db, "users", profileDoc.id), {
          forceDefaultPassword: false,
          updatedAt: new Date(),
        });
      }

      // (Only for already-accepted users) your original Instructor activation logic
      if (role === "Instructor" && currentActivateStatus === "inactive") {
        try {
          const usersRef = collection(db, "users");
          const activeInstructorQuery = query(
            usersRef,
            where("activate", "==", "active"),
            where("role", "==", "Instructor"),
            limit(1)
          );
          const activeInstructorSnap = await getDocs(activeInstructorQuery);
          if (!activeInstructorSnap.empty) {
            const activeInstructorDoc = activeInstructorSnap.docs[0];
            await updateDoc(doc(db, "users", activeInstructorDoc.id), {
              activate: "retired",
              updatedAt: new Date(),
            });
          }
        } catch (retireError) {
          console.error("Error retiring active instructor:", retireError);
        }
      }

      // mark current user active (same as your previous behavior)
      await updateDoc(doc(db, "users", profileDoc.id), {
        activate: "active",
        updatedAt: new Date(),
      });

      // go to dashboard
      navigate(routeForRole(role), { replace: true });
    } catch (e2) {
      console.error("Login error:", e2);
      let msg = "Sign-in failed. Please check your credentials.";
      if (e2.code === "auth/invalid-email") msg = "Invalid email address.";
      else if (
        e2.code === "auth/user-not-found" ||
        e2.code === "auth/wrong-password"
      )
        msg = "Incorrect email/ID number or password.";
      else if (e2.code === "auth/too-many-requests")
        msg = "Too many attempts. Try again later.";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <LoginHeader />

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 px-6 md:px-16 pt-10 pb-8">
        <div className="flex justify-center md:justify-end">
          <div className="w-full max-w-lg bg-white border border-neutral-200 rounded-2xl shadow-lg px-10 py-12">
            <div className="text-center">
              <h1 className="text-3xl md:text-4xl font-bold leading-snug text-[#3b0b0e]">
                Welcome to
                <br />
                TaskSphere IT
              </h1>
              <div className="mx-auto mt-6 h-20 w-20 grid place-items-center">
                <img
                  src={TaskSphereLogo}
                  alt="TaskSphere Logo"
                  className="object-contain h-full w-full"
                />
              </div>
            </div>

            <form onSubmit={handleSignIn} className="mt-8 space-y-5">
              <div>
                <label className="block text-sm font-medium text-neutral-700">
                  Email or ID Number
                </label>
                <input
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="name@example.com or 2081221155180"
                  autoComplete="username"
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6A0F14]/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    value={pwd}
                    onChange={(e) => setPwd(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-[#6A0F14]/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((s) => !s)}
                    aria-label={showPwd ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 grid place-items-center px-3 text-neutral-500 hover:text-neutral-700"
                    tabIndex={-1}
                  >
                    {showPwd ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 3l18 18M10.584 10.59a3 3 0 104.243 4.243M9.88 5.08A8.967 8.967 0 0112 5c4.5 0 8.268 2.943 9.75 7-.365 1.053-.915 2.03-1.62 2.9m-3.014 2.518A10.013 10.013 0 0112 19c-4.5 0-8.268-2.943-9.542-7a11.415 11.415 0 012.694-4.042"
                        />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    )}
                  </button>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <div className="h-5">
                    {err && <p className="text-xs text-red-600">{err}</p>}
                  </div>
                  <Link
                    to="/forgot-password"
                    className="text-sm text-[#6A0F14] hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !loginId.trim() || !pwd.trim()}
                className="mt-2 w-48 mx-auto block rounded-full px-6 py-3 text-white font-medium hover:opacity-95 active:scale-[.99] bg-[#6A0F14] disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          </div>
        </div>

        <div className="flex items-center justify-center text-center md:text-left">
          <div className="flex flex-col md:flex-row md:items-center md:gap-6">
            <img
              src={CCSLogo}
              alt="CCS Logo"
              className="mx-auto md:mx-0 h-28 w-28 object-contain"
            />
            <h2 className="mt-6 md:mt-0 text-2xl md:text-3xl font-bold text-neutral-700 max-w-md">
              A Task Management System for
              <br className="hidden md:block" />
              Capstone Project Development
            </h2>
          </div>
        </div>
      </div>

      <LoginFooter />
    </div>
  );
};

export default LoginPage;