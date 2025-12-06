// src/components/auth/LoginPage.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import LoginHeader from "../common/LoginHeader.jsx";
import LoginFooter from "../common/LoginFooter.jsx";
import TaskSphereLogo from "../../assets/imgs/TaskSphereLogo.png";
import CCSLogo from "../../assets/imgs/ccs-logo.png";
import LoginImage from "../../assets/imgs/login-img3.png";

// Firebase
import { auth, db } from "../../config/firebase";
import {
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  onAuthStateChanged,
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
  const [loginId, setLoginId] = useState("");
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const [showGoodluck, setShowGoodluck] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    setIsMounted(true);
    
    // Start the breaking animation sequence after page loads
    const startAnimation = () => {
      const interval = setInterval(() => {
        setShowGoodluck(true);
        setTimeout(() => {
          setShowGoodluck(false);
        }, 3000); // Show "Goodluck!" for 3 seconds
      }, 6000); // Repeat every 6 seconds (3 seconds show + 3 seconds hidden)

      return () => clearInterval(interval);
    };

    const timer = setTimeout(startAnimation, 1000); // Start animation 1 second after page load
    return () => {
      clearTimeout(timer);
    };
  }, []);

  const routeForRole = (role) => {
    if (role === "Adviser") return "/adviser/dashboard";
    if (role === "Member") return "/member/dashboard";
    if (role === "Project Manager") return "/projectmanager/dashboard";
    return "/instructor/dashboard";
  };

  /* ====================== LOCK BACK NAV WHILE ON /login ====================== */
  useEffect(() => {
    const trap = (ev) => {
      ev?.preventDefault?.();
      navigate("/login", { replace: true });
    };
    
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", trap);

    const onShow = (e) => {
      if (e.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", onShow);

    return () => {
      window.removeEventListener("popstate", trap);
      window.removeEventListener("pageshow", onShow);
    };
  }, [navigate]);

  /* =================== GUARD: block /login when already authed ============== */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      try {
        if (!u) return;

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

        if (typeof data.isTosAccepted !== "boolean") {
          await updateDoc(doc(db, "users", d.id), {
            isTosAccepted: false,
            updatedAt: new Date(),
          });
        }

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

  const findUserByEmailOrIdNumber = async (identifier) => {
    const usersRef = collection(db, "users");
    const trimmedId = identifier.trim();

    const byEmail = query(usersRef, where("email", "==", trimmedId), limit(1));
    const emailSnap = await getDocs(byEmail);

    if (!emailSnap.empty) {
      return emailSnap.docs[0];
    }

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

      const profileDoc = await findUserByEmailOrIdNumber(identifier);

      if (!profileDoc) {
        setErr("Account not found. Please check your email/ID number.");
        setLoading(false);
        return;
      }

      const profile = profileDoc.data();
      const userEmail = profile.email;

      if (!userEmail) {
        setErr("Invalid account configuration. Please contact administrator.");
        setLoading(false);
        return;
      }

      const cred = await signInWithEmailAndPassword(auth, userEmail, pwd);

      if (cred.user.uid !== profile.uid) {
        await updateDoc(doc(db, "users", profileDoc.id), {
          uid: cred.user.uid,
          updatedAt: new Date(),
        });
      }

      const role = profile.role || null;
      const currentActivateStatus = profile.activate;

      if (role === "Instructor" && currentActivateStatus === "retired") {
        await signOut(auth);
        setErr("Invalid credentials. This account is no longer active.");
        setLoading(false);
        return;
      }

      if (typeof profile.isTosAccepted !== "boolean") {
        await updateDoc(doc(db, "users", profileDoc.id), {
          isTosAccepted: false,
          updatedAt: new Date(),
        });
        profile.isTosAccepted = false;
      }

      localStorage.setItem("uid", cred.user.uid);
      if (role) localStorage.setItem("role", role);

      if (profile.isTosAccepted !== true) {
        navigate("/terms-of-service", {
          replace: true,
          state: { from: routeForRole(role) },
        });
        setLoading(false);
        return;
      }

      if (profile.forceDefaultPassword) {
        await updatePassword(cred.user, DEFAULT_PASSWORD);
        await updateDoc(doc(db, "users", profileDoc.id), {
          forceDefaultPassword: false,
          updatedAt: new Date(),
        });
      }

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

      await updateDoc(doc(db, "users", profileDoc.id), {
        activate: "active",
        updatedAt: new Date(),
      });

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
        {/* Left Side - Login Form */}
        <div className="flex justify-center md:justify-end">
          <div 
            className={`w-full max-w-lg bg-white border border-neutral-200 rounded-2xl shadow-lg px-10 py-12 transition-all duration-700 ${
              isMounted ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'
            }`}
          >
            <div className="text-center">
              <h1 className="text-3xl md:text-4xl font-bold leading-snug text-[#3b0b0e]">
                Welcome to
                <br />
                TaskSphere IT
              </h1>
              <div className="mx-auto mt-6 h-28 w-28 grid place-items-center">
                <img
                  src={TaskSphereLogo}
                  alt="TaskSphere Logo"
                  className="object-contain h-full w-full"
                />
              </div>
            </div>

            <form onSubmit={handleSignIn} className="mt-8 space-y-5">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-700">
                  Email or ID Number
                </label>
                <input
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="name@example.com or 2081221155180"
                  autoComplete="username"
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6A0F14]/50 transition-all duration-300 focus:border-[#6A0F14]"
                />
              </div>

              <div className="space-y-2">
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
                    className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-[#6A0F14]/50 transition-all duration-300 focus:border-[#6A0F14]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((s) => !s)}
                    aria-label={showPwd ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 grid place-items-center px-3 text-neutral-500 hover:text-neutral-700 transition-colors duration-200"
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
                    {err && (
                      <p className="text-xs text-red-600 animate-pulse">
                        {err}
                      </p>
                    )}
                  </div>
                  <Link
                    to="/forgot-password"
                    className="text-sm text-[#6A0F14] hover:underline transition-colors duration-200"
                  >
                    Forgot password?
                  </Link>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !loginId.trim() || !pwd.trim()}
                className="mt-2 w-48 mx-auto block rounded-full px-6 py-3 text-white font-medium hover:opacity-95 active:scale-[.99] bg-[#6A0F14] disabled:opacity-60 transition-all duration-300 transform hover:scale-105"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Signing in...
                  </div>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Side - Brand Section */}
        <div className="flex items-center justify-center text-center">
          <div 
            className={`flex flex-col items-center transition-all duration-700 delay-300 ${
              isMounted ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'
            }`}
          >
            <img
              src={CCSLogo}
              alt="CCS Logo"
              className="h-28 w-28 object-contain -mt-6 mb-1 animate-float"
            />
            <h2 className="text-2xl md:text-3xl font-bold max-w-md leading-tight mb-2">
              <span className="text-black">A Task Management System for</span>
              <br />
              <span className="text-[#6A0F14]">Capstone Project Development</span>
            </h2>
            <div className="mt-0 relative">
              {/* Main Image with Breaking Animation */}
              <div className="relative">
                <img
                  src={LoginImage}
                  alt="Task Management System"
                  className={`w-96 h-72 object-contain transition-all duration-500 ${
                    showGoodluck 
                      ? 'scale-75 opacity-0 blur-sm' 
                      : 'scale-100 opacity-100 blur-0'
                  }`}
                />
                
                {/* Realistic Bloody Goodluck Text Overlay */}
                <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
                  showGoodluck 
                    ? 'opacity-100 scale-100' 
                    : 'opacity-0 scale-50'
                }`}>
                  <div className="text-center relative">
                    {/* Main Bloody Text */}
                    <div className="text-6xl font-bold text-[#3B0304] animate-pulse drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] relative z-10">
                      Goodluck!
                      {/* Blood texture overlay */}
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#3B0304]/20 to-[#3B0304]/40 rounded-lg mix-blend-multiply"></div>
                    </div>
                    
                    {/* Realistic Blood Drips */}
                    <div className="absolute -bottom-3 left-6 w-3 h-10 bg-[#3B0304] rounded-full animate-blood-drip-1" 
                         style={{clipPath: 'polygon(0% 0%, 100% 0%, 80% 100%, 20% 100%)'}}></div>
                    <div className="absolute -bottom-2 left-14 w-2 h-8 bg-[#3B0304] rounded-full animate-blood-drip-2"
                         style={{clipPath: 'polygon(0% 0%, 100% 0%, 70% 100%, 30% 100%)'}}></div>
                    <div className="absolute -bottom-4 right-10 w-4 h-12 bg-[#3B0304] rounded-full animate-blood-drip-3"
                         style={{clipPath: 'polygon(0% 0%, 100% 0%, 85% 100%, 15% 100%)'}}></div>
                    <div className="absolute -bottom-3 right-20 w-2 h-9 bg-[#3B0304] rounded-full animate-blood-drip-4"
                         style={{clipPath: 'polygon(0% 0%, 100% 0%, 75% 100%, 25% 100%)'}}></div>
                    
                    {/* Blood Pools at bottom */}
                    <div className="absolute -bottom-6 left-4 w-8 h-4 bg-[#3B0304] rounded-full opacity-80 animate-blood-pool-1"></div>
                    <div className="absolute -bottom-5 right-16 w-6 h-3 bg-[#3B0304] rounded-full opacity-90 animate-blood-pool-2"></div>
                  </div>
                </div>

                {/* Realistic Blood Splatter Effect */}
                <div className={`absolute inset-0 pointer-events-none ${
                  showGoodluck ? 'opacity-100' : 'opacity-0'
                } transition-opacity duration-300`}>
                  {/* Organic blood splatter shapes */}
                  <div className="absolute top-6 left-12 w-10 h-8 bg-[#3B0304] opacity-70 animate-blood-splatter-1"
                       style={{clipPath: 'polygon(50% 0%, 80% 20%, 100% 50%, 80% 80%, 50% 100%, 20% 80%, 0% 50%, 20% 20%)'}}></div>
                  <div className="absolute top-10 right-16 w-7 h-6 bg-[#3B0304] opacity-80 animate-blood-splatter-2"
                       style={{clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)'}}></div>
                  <div className="absolute bottom-10 left-20 w-9 h-7 bg-[#3B0304] opacity-60 animate-blood-splatter-3"
                       style={{clipPath: 'polygon(25% 0%, 75% 0%, 100% 25%, 100% 75%, 75% 100%, 25% 100%, 0% 75%, 0% 25%)'}}></div>
                  <div className="absolute bottom-14 right-8 w-6 h-5 bg-[#3B0304] opacity-90 animate-blood-splatter-4"
                       style={{clipPath: 'polygon(40% 0%, 60% 0%, 100% 40%, 100% 60%, 60% 100%, 40% 100%, 0% 60%, 0% 40%)'}}></div>
                  
                  {/* Small blood droplets */}
                  <div className="absolute top-4 left-24 w-3 h-3 bg-[#3B0304] rounded-full opacity-90 animate-blood-droplet-1"></div>
                  <div className="absolute top-16 right-6 w-2 h-2 bg-[#3B0304] rounded-full opacity-80 animate-blood-droplet-2"></div>
                  <div className="absolute bottom-8 left-8 w-2 h-2 bg-[#3B0304] rounded-full opacity-85 animate-blood-droplet-3"></div>
                  <div className="absolute bottom-20 right-24 w-3 h-3 bg-[#3B0304] rounded-full opacity-75 animate-blood-droplet-4"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <LoginFooter />

      {/* Add custom realistic blood animations to global CSS */}
      <style jsx>{`
        @keyframes blood-drip-1 {
          0% { transform: translateY(-30px) scaleY(0.1); opacity: 0; }
          30% { transform: translateY(-15px) scaleY(0.5); opacity: 0.5; }
          60% { transform: translateY(0px) scaleY(1); opacity: 1; }
          100% { transform: translateY(5px) scaleY(1.1); opacity: 0.9; }
        }
        @keyframes blood-drip-2 {
          0% { transform: translateY(-25px) scaleY(0.1); opacity: 0; }
          35% { transform: translateY(-12px) scaleY(0.4); opacity: 0.4; }
          65% { transform: translateY(0px) scaleY(1); opacity: 1; }
          100% { transform: translateY(4px) scaleY(1.05); opacity: 0.8; }
        }
        @keyframes blood-drip-3 {
          0% { transform: translateY(-35px) scaleY(0.1); opacity: 0; }
          25% { transform: translateY(-20px) scaleY(0.6); opacity: 0.6; }
          70% { transform: translateY(0px) scaleY(1); opacity: 1; }
          100% { transform: translateY(6px) scaleY(1.15); opacity: 0.7; }
        }
        @keyframes blood-drip-4 {
          0% { transform: translateY(-28px) scaleY(0.1); opacity: 0; }
          40% { transform: translateY(-14px) scaleY(0.45); opacity: 0.45; }
          75% { transform: translateY(0px) scaleY(1); opacity: 1; }
          100% { transform: translateY(5px) scaleY(1.08); opacity: 0.85; }
        }
        @keyframes blood-pool-1 {
          0% { transform: scale(0); opacity: 0; }
          70% { transform: scale(1.1); opacity: 0.9; }
          100% { transform: scale(1); opacity: 0.8; }
        }
        @keyframes blood-pool-2 {
          0% { transform: scale(0); opacity: 0; }
          80% { transform: scale(1.05); opacity: 0.95; }
          100% { transform: scale(1); opacity: 0.9; }
        }
        @keyframes blood-splatter-1 {
          0% { transform: scale(0) rotate(0deg) translate(0, 0); opacity: 0; }
          50% { transform: scale(1.3) rotate(45deg) translate(5px, -5px); opacity: 0.8; }
          100% { transform: scale(1) rotate(90deg) translate(2px, -2px); opacity: 0.7; }
        }
        @keyframes blood-splatter-2 {
          0% { transform: scale(0) rotate(0deg) translate(0, 0); opacity: 0; }
          45% { transform: scale(1.2) rotate(-30deg) translate(-4px, 3px); opacity: 0.9; }
          100% { transform: scale(1) rotate(-60deg) translate(-2px, 1px); opacity: 0.8; }
        }
        @keyframes blood-splatter-3 {
          0% { transform: scale(0) rotate(0deg) translate(0, 0); opacity: 0; }
          55% { transform: scale(1.4) rotate(15deg) translate(3px, 4px); opacity: 0.7; }
          100% { transform: scale(1) rotate(30deg) translate(1px, 2px); opacity: 0.6; }
        }
        @keyframes blood-splatter-4 {
          0% { transform: scale(0) rotate(0deg) translate(0, 0); opacity: 0; }
          40% { transform: scale(1.25) rotate(-15deg) translate(-3px, -2px); opacity: 0.95; }
          100% { transform: scale(1) rotate(-45deg) translate(-1px, -1px); opacity: 0.9; }
        }
        @keyframes blood-droplet-1 {
          0% { transform: scale(0) translate(0, 0); opacity: 0; }
          50% { transform: scale(1.2) translate(2px, -1px); opacity: 0.9; }
          100% { transform: scale(1) translate(1px, 0px); opacity: 0.8; }
        }
        @keyframes blood-droplet-2 {
          0% { transform: scale(0) translate(0, 0); opacity: 0; }
          60% { transform: scale(1.1) translate(-1px, 1px); opacity: 0.85; }
          100% { transform: scale(1) translate(0px, 0px); opacity: 0.8; }
        }
        @keyframes blood-droplet-3 {
          0% { transform: scale(0) translate(0, 0); opacity: 0; }
          55% { transform: scale(1.15) translate(1px, -1px); opacity: 0.9; }
          100% { transform: scale(1) translate(0px, 0px); opacity: 0.85; }
        }
        @keyframes blood-droplet-4 {
          0% { transform: scale(0) translate(0, 0); opacity: 0; }
          45% { transform: scale(1.3) translate(-2px, 1px); opacity: 0.8; }
          100% { transform: scale(1) translate(-1px, 0px); opacity: 0.75; }
        }
        .animate-blood-drip-1 {
          animation: blood-drip-1 0.8s ease-out forwards;
        }
        .animate-blood-drip-2 {
          animation: blood-drip-2 0.8s ease-out 0.1s forwards;
        }
        .animate-blood-drip-3 {
          animation: blood-drip-3 0.8s ease-out 0.2s forwards;
        }
        .animate-blood-drip-4 {
          animation: blood-drip-4 0.8s ease-out 0.15s forwards;
        }
        .animate-blood-pool-1 {
          animation: blood-pool-1 0.8s ease-out 0.3s forwards;
        }
        .animate-blood-pool-2 {
          animation: blood-pool-2 0.8s ease-out 0.4s forwards;
        }
        .animate-blood-splatter-1 {
          animation: blood-splatter-1 0.6s ease-out forwards;
        }
        .animate-blood-splatter-2 {
          animation: blood-splatter-2 0.6s ease-out 0.1s forwards;
        }
        .animate-blood-splatter-3 {
          animation: blood-splatter-3 0.6s ease-out 0.2s forwards;
        }
        .animate-blood-splatter-4 {
          animation: blood-splatter-4 0.6s ease-out 0.15s forwards;
        }
        .animate-blood-droplet-1 {
          animation: blood-droplet-1 0.5s ease-out 0.2s forwards;
        }
        .animate-blood-droplet-2 {
          animation: blood-droplet-2 0.5s ease-out 0.3s forwards;
        }
        .animate-blood-droplet-3 {
          animation: blood-droplet-3 0.5s ease-out 0.25s forwards;
        }
        .animate-blood-droplet-4 {
          animation: blood-droplet-4 0.5s ease-out 0.35s forwards;
        }
      `}</style>
    </div>
  );
};

export default LoginPage;