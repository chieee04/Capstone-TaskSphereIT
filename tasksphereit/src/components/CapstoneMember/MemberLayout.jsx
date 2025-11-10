// src/components/CapstoneMember/MemberLayout.jsx
import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import TaskSphereLogo from "../../assets/imgs/TaskSphereLogo.png";
import MemberHeader from "./MemberHeader";
import MemberFooter from "./MemberFooter";
import MemberProfile from "./MemberProfile";
import NotificationBanner from "../common/NotificationBanner";

import { auth } from "../../config/firebase";
import { signOut } from "firebase/auth";

// ⬇️ add the missing icons
import {
  Home,
  ClipboardList,
  File,
  FileText,
  Calendar,
  LogOut,
} from "lucide-react";

 function MemberLayout() {
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  // ⬇️ bring back the sidebar item style helper
  const navItemClasses = (isActive) =>
    `flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium ${
      isActive
        ? "bg-[#6A0F14]/10 text-[#6A0F14]"
        : "text-neutral-700 hover:bg-neutral-100"
    }`;

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await signOut(auth);
      localStorage.removeItem("uid");
      localStorage.removeItem("role");
      navigate("/login", { replace: true });
    } catch (e) {
      console.error(e);
      localStorage.removeItem("uid");
      localStorage.removeItem("role");
      navigate("/login", { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50">
      {/* Sidebar */}
      <aside className="hidden md:flex md:flex-col w-64 bg-white border-r border-neutral-200">
        <div className="flex flex-col h-full py-6">
          <div className="flex items-center justify-center mb-8 px-4">
            <img src={TaskSphereLogo} alt="TaskSphere IT" className="h-10" />
          </div>

          <nav className="flex-1 px-4 space-y-1">
            <NavLink
              to="/member/dashboard"
              className={({ isActive }) => navItemClasses(isActive)}
            >
              <Home className="w-5 h-5" /> Dashboard
            </NavLink>
            <NavLink
              to="/member/tasks"
              className={({ isActive }) => navItemClasses(isActive)}
            >
              <ClipboardList className="w-5 h-5" /> Tasks
            </NavLink>
            <NavLink
              to="/member/adviser-tasks"
              className={({ isActive }) => navItemClasses(isActive)}
            >
              <File className="w-5 h-5" /> Adviser Tasks
            </NavLink>
            <NavLink
              to="/member/tasks-board"
              className={({ isActive }) => navItemClasses(isActive)}
            >
              <FileText className="w-5 h-5" /> Tasks Board
            </NavLink>
            <NavLink
              to="/member/tasks-record"
              className={({ isActive }) => navItemClasses(isActive)}
            >
              <ClipboardList className="w-5 h-5" /> Tasks Record
            </NavLink>
            <NavLink
              to="/member/events"
              className={({ isActive }) => navItemClasses(isActive)}
            >
              <Calendar className="w-5 h-5" /> Events
            </NavLink>
          </nav>

          <div className="mt-auto px-4">
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full flex items-center gap-3 justify-center text-sm font-medium text-[#6A0F14] border border-[#6A0F14] rounded-full px-4 py-2 hover:bg-[#6A0F14]/10 disabled:opacity-60"
            >
              <LogOut className="w-5 h-5" />
              {loggingOut ? "Signing out…" : "Sign Out"}
            </button>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-h-0">
        <MemberHeader onOpenProfile={() => setShowProfile(true)} />

        <main className="flex-1 min-h-0 overflow-y-auto px-4 py-6 md:px-8">
          <NotificationBanner role="Member" />
          <Outlet />
        </main>

        <MemberFooter />
      </div>

      {/* Profile Drawer (same width as Instructor) */}
      {showProfile && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/40"
            onClick={() => setShowProfile(false)}
          />
          <aside
            className="fixed right-0 top-0 z-[61] h-full
                       w-[560px] md:w-[520px] sm:w-[480px]
                       bg-white border-l border-neutral-200 shadow-2xl"
            role="dialog"
            aria-modal="true"
          >
            <div className="h-full overflow-y-auto p-6">
              <MemberProfile />
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

export default MemberLayout
