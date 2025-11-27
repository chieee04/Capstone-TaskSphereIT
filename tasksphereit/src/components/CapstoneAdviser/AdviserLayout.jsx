// src/components/CapstoneAdviser/AdviserLayout.jsx
import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Home,
  Calendar,
  ClipboardList,
  Users,
  FileText,
  ListChecks,
  LogOut,
  X,
} from "lucide-react";
import TaskSphereLogo from "../../assets/imgs/TaskSphereLogo.png";
import AdviserHeader from "./AdviserHeader";
import AdviserFooter from "./AdviserFooter";
import NotificationBanner from "../common/NotificationBanner";


import AdviserProfile from "./AdviserProfile";


// Firebase
import { auth } from "../../config/firebase";
import { signOut } from "firebase/auth";


const AdviserLayout = () => {
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);


  // PROFILE DRAWER STATE
  const [showProfile, setShowProfile] = useState(false);


  // Close sidebars on Esc
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (showProfile) setShowProfile(false);
        if (sidebarOpen) setSidebarOpen(false);
      }
    };
   
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showProfile, sidebarOpen]);


  // Close mobile sidebar when navigating
  const handleNavigation = () => {
    if (sidebarOpen) {
      setSidebarOpen(false);
    }
  };


  const item = (isActive) =>
    `flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
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
      console.error("Logout failed:", e);
      localStorage.removeItem("uid");
      localStorage.removeItem("role");
      navigate("/login", { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };


  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50">
      {/* Desktop Sidebar - Only visible on lg and up */}
      <aside className="hidden lg:flex lg:flex-col w-64 bg-white border-r border-neutral-200 flex-shrink-0">
        <div className="flex flex-col h-full py-6">
          <div className="flex items-center justify-center mb-8 px-4">
            <img src={TaskSphereLogo} alt="TaskSphere IT" className="h-10" />
          </div>


          <nav className="flex-1 px-4 space-y-1">
            <NavLink
              to="/adviser/dashboard"
              className={({ isActive }) => item(isActive)}
            >
              <Home className="w-5 h-5" /> Dashboard
            </NavLink>
            <NavLink
              to="/adviser/teams-summary"
              className={({ isActive }) => item(isActive)}
            >
              <FileText className="w-5 h-5" /> Teams Summary
            </NavLink>
            <NavLink
              to="/adviser/tasks"
              className={({ isActive }) => item(isActive)}
            >
              <ListChecks className="w-5 h-5" /> Tasks
            </NavLink>
            <NavLink
              to="/adviser/teams-board"
              className={({ isActive }) => item(isActive)}
            >
              <Users className="w-5 h-5" /> Teams Board
            </NavLink>
            <NavLink
              to="/adviser/task-record"
              className={({ isActive }) => item(isActive)}
            >
              <ClipboardList className="w-5 h-5" /> Task Record
            </NavLink>
            <NavLink
              to="/adviser/events"
              className={({ isActive }) => item(isActive)}
            >
              <Calendar className="w-5 h-5" /> Events
            </NavLink>
          </nav>


          <div className="mt-auto px-4">
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="cursor-pointer w-full flex items-center justify-center gap-3 text-sm font-medium text-[#6A0F14] border border-[#6A0F14] rounded-full px-4 py-2 hover:bg-[#6A0F14]/10 disabled:opacity-60 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              {loggingOut ? "Signing out…" : "Sign Out"}
            </button>
          </div>
        </div>
      </aside>


      {/* Mobile & Tablet Sidebar Overlay */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-[50] bg-black/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Mobile & Tablet Sidebar Panel */}
          <aside
            className="fixed left-0 top-0 z-[51] h-full w-64 bg-white border-r border-neutral-200 shadow-2xl lg:hidden transition-transform duration-300"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex flex-col h-full py-6">
              <div className="flex items-center justify-between mb-8 px-4">
                <img src={TaskSphereLogo} alt="TaskSphere IT" className="h-10" />
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>


              <nav className="flex-1 px-4 space-y-1">
                <NavLink
                  to="/adviser/dashboard"
                  onClick={handleNavigation}
                  className={({ isActive }) => item(isActive)}
                >
                  <Home className="w-5 h-5" /> Dashboard
                </NavLink>
                <NavLink
                  to="/adviser/teams-summary"
                  onClick={handleNavigation}
                  className={({ isActive }) => item(isActive)}
                >
                  <FileText className="w-5 h-5" /> Teams Summary
                </NavLink>
                <NavLink
                  to="/adviser/tasks"
                  onClick={handleNavigation}
                  className={({ isActive }) => item(isActive)}
                >
                  <ListChecks className="w-5 h-5" /> Tasks
                </NavLink>
                <NavLink
                  to="/adviser/teams-board"
                  onClick={handleNavigation}
                  className={({ isActive }) => item(isActive)}
                >
                  <Users className="w-5 h-5" /> Teams Board
                </NavLink>
                <NavLink
                  to="/adviser/task-record"
                  onClick={handleNavigation}
                  className={({ isActive }) => item(isActive)}
                >
                  <ClipboardList className="w-5 h-5" /> Task Record
                </NavLink>
                <NavLink
                  to="/adviser/events"
                  onClick={handleNavigation}
                  className={({ isActive }) => item(isActive)}
                >
                  <Calendar className="w-5 h-5" /> Events
                </NavLink>
              </nav>


              <div className="mt-auto px-4">
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="cursor-pointer w-full flex items-center justify-center gap-3 text-sm font-medium text-[#6A0F14] border border-[#6A0F14] rounded-full px-4 py-2 hover:bg-[#6A0F14]/10 disabled:opacity-60 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  {loggingOut ? "Signing out…" : "Sign Out"}
                </button>
              </div>
            </div>
          </aside>
        </>
      )}


      {/* Main column - Full width on all screens */}
      <div className="flex-1 flex flex-col min-h-0 w-full min-w-0">
        {/* Pass the opener to the header */}
        <AdviserHeader
          onProfileClick={() => setShowProfile(true)}
          onMenuClick={() => setSidebarOpen(true)}
        />


        {/* Scroll area - Better responsive padding */}
        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-4 sm:py-6 md:px-6 lg:px-8">
          <NotificationBanner role="Adviser" />
          <Outlet />
        </main>


        <AdviserFooter />
      </div>


      {/* PROFILE DRAWER */}
      {showProfile && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-[60] bg-black/40"
            onClick={() => setShowProfile(false)}
          />
          {/* Panel */}
          <aside
            className="fixed right-0 top-0 z-[61] h-full w-full max-w-md bg-white border-l border-neutral-200 shadow-2xl"
            role="dialog"
            aria-modal="true"
          >
            <div className="h-full overflow-y-auto p-4 sm:p-6">
              <AdviserProfile />
            </div>
          </aside>
        </>
      )}
    </div>
  );
};


export default AdviserLayout;


