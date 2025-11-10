import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Home, ClipboardList, Users, Calendar, Shield, LogOut, X } from "lucide-react";
import TaskSphereLogo from "../../assets/imgs/TaskSphereLogo.png";
import InstructorHeader from "./InstructorHeader";
import InstructorFooter from "./InstructorFooter";

// 👉 Import your profile component here
import InstructorProfile from "./InstructorProfile";

// Firebase
import { auth } from "../../config/firebase";
import { signOut } from "firebase/auth";

const InstructorLayout = () => {
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  // NEW: control the profile overlay
  const [showProfile, setShowProfile] = useState(false);

  const navItemClasses = (isActive) =>
    `flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium ${
      isActive ? "bg-[#6A0F14]/10 text-[#6A0F14]" : "text-neutral-700 hover:bg-neutral-100"
    }`;

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await signOut(auth);
      localStorage.removeItem("uid");
      localStorage.removeItem("role");
      navigate("/login", { replace: true });
    } catch (e) {
      console.error("Logout failed:", e);
      localStorage.removeItem("uid");
      localStorage.removeItem("role");
      navigate("/login", { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    // Lock the window: full viewport height + no window scroll
    <div className="flex h-screen overflow-hidden bg-neutral-50">
      {/* Sidebar */}
      <aside className="hidden md:flex md:flex-col w-64 bg-white border-r border-neutral-200">
        <div className="flex flex-col h-full py-6">
          <div className="flex items-center justify-center mb-8 px-4">
            <img src={TaskSphereLogo} alt="TaskSphere IT" className="h-10" />
          </div>

          <nav className="flex-1 px-4 space-y-1">
            <NavLink to="/instructor/dashboard" className={({ isActive }) => navItemClasses(isActive)}>
              <Home className="w-5 h-5" /> Dashboard
            </NavLink>
            <NavLink to="/instructor/enroll" className={({ isActive }) => navItemClasses(isActive)}>
              <ClipboardList className="w-5 h-5" /> Enroll
            </NavLink>
            <NavLink to="/instructor/teams" className={({ isActive }) => navItemClasses(isActive)}>
              <Users className="w-5 h-5" /> Teams
            </NavLink>
            <NavLink to="/instructor/schedule" className={({ isActive }) => navItemClasses(isActive)}>
              <Calendar className="w-5 h-5" /> Schedule
            </NavLink>
            
          </nav>

          <div className="mt-auto px-4">
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="cursor-pointer w-full flex items-center justify-center gap-3 text-sm font-medium text-[#6A0F14] border border-[#6A0F14] rounded-full px-4 py-2 hover:bg-[#6A0F14]/10 disabled:opacity-60"
            >
              <LogOut className="w-5 h-5" />
              {loggingOut ? "Signing out…" : "Sign Out"}
            </button>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Pass a click handler down to open the profile */}
        <InstructorHeader onProfileClick={() => setShowProfile(true)} />

        <main className="flex-1 min-h-0 overflow-y-auto px-4 py-6 md:px-8">
          <Outlet />
        </main>

        <InstructorFooter />
      </div>

      {/* Profile Overlay (owned by the layout so it can render above all routes) */}
      {showProfile && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowProfile(false)}
            aria-hidden="true"
          />
          {/* Right-side drawer */}
          <div className="absolute right-0 top-0 h-full w-full max-w-[560px] bg-white shadow-2xl border-l border-neutral-200 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200">
              <h2 className="text-[16px] font-semibold text-[#6A0F14]">Profile</h2>
              <button
                onClick={() => setShowProfile(false)}
                className="p-2 rounded-md hover:bg-neutral-100"
                aria-label="Close profile"
              >
                <X className="w-5 h-5 text-neutral-600" />
              </button>
            </div>

            {/* Content area: render your profile component here */}
            <div className="flex-1 overflow-y-auto p-5">
              <InstructorProfile />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstructorLayout;
