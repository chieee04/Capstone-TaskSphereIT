// src/components/ProjectManager/ProjectManagerLayout.jsx
import React, { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Home,
  Calendar,
  ClipboardList,
  ListChecks,
  LogOut,
  KanbanSquare,
  X,
} from "lucide-react";
import TaskSphereLogo from "../../assets/imgs/TaskSphereLogo.png";
import ProjectManagerHeader from "./ProjectManagerHeader";
import ProjectManagerFooter from "./ProjectManagerFooter";
import ProjectManagerProfile from "./ProjectManagerProfile";
import NotificationBanner from "../common/NotificationBanner";

// Firebase
import { auth } from "../../config/firebase";
import { signOut } from "firebase/auth";

const navItemClasses = (isActive) =>
  `flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
    isActive
      ? "bg-[#6A0F14]/10 text-[#6A0F14]"
      : "text-[#6A0F14] hover:bg-neutral-100"
  }`;

export default function ProjectManagerLayout() {
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  // Prevent body scroll when sidebar is open
  useEffect(() => {
    if (sidebarOpen || showProfile) { // Added showProfile to prevent scroll when profile is open
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [sidebarOpen, showProfile]); // Added showProfile dependency

  // Close mobile sidebar when navigating
  const handleNavigation = () => {
    if (sidebarOpen) {
      setSidebarOpen(false);
    }
  };

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
      <aside className="hidden lg:flex lg:flex-col w-64 min-w-[16rem] shrink-0 bg-white border-r border-neutral-200">
        <div className="flex flex-col h-full py-6">
          <div className="flex items-center justify-center mb-8 px-4">
            <img src={TaskSphereLogo} alt="TaskSphere IT" className="h-10" />
          </div>

          <nav className="flex-1 px-4 space-y-2">
            <NavLink
              to="/projectmanager/dashboard"
              className={({ isActive }) => navItemClasses(isActive)}
            >
              <Home className="w-5 h-5" /> Dashboard
            </NavLink>
            <NavLink
              to="/projectmanager/tasks"
              className={({ isActive }) => navItemClasses(isActive)}
            >
              <ClipboardList className="w-5 h-5" /> Tasks
            </NavLink>
            <NavLink
              to="/projectmanager/tasks-board"
              className={({ isActive }) => navItemClasses(isActive)}
            >
              <KanbanSquare className="w-5 h-5" /> Tasks Board
            </NavLink>
            <NavLink
              to="/projectmanager/tasks-record"
              className={({ isActive }) => navItemClasses(isActive)}
            >
              <ListChecks className="w-5 h-5" /> Tasks Record
            </NavLink>
            <NavLink
              to="/projectmanager/events"
              className={({ isActive }) => navItemClasses(isActive)}
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
            className="fixed left-0 top-0 z-[51] h-full w-64 bg-white border-r border-neutral-200 shadow-2xl lg:hidden transform transition-transform duration-300 ease-in-out"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex flex-col h-full py-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-8 px-4">
                <img src={TaskSphereLogo} alt="TaskSphere IT" className="h-10" />
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 px-4 space-y-2">
                <NavLink
                  to="/projectmanager/dashboard"
                  onClick={handleNavigation}
                  className={({ isActive }) => navItemClasses(isActive)}
                >
                  <Home className="w-5 h-5" /> Dashboard
                </NavLink>
                <NavLink
                  to="/projectmanager/tasks"
                  onClick={handleNavigation}
                  className={({ isActive }) => navItemClasses(isActive)}
                >
                  <ClipboardList className="w-5 h-5" /> Tasks
                </NavLink>
                <NavLink
                  to="/projectmanager/tasks-board"
                  onClick={handleNavigation}
                  className={({ isActive }) => navItemClasses(isActive)}
                >
                  <KanbanSquare className="w-5 h-5" /> Tasks Board
                </NavLink>
                <NavLink
                  to="/projectmanager/tasks-record"
                  onClick={handleNavigation}
                  className={({ isActive }) => navItemClasses(isActive)}
                >
                  <ListChecks className="w-5 h-5" /> Tasks Record
                </NavLink>
                <NavLink
                  to="/projectmanager/events"
                  onClick={handleNavigation}
                  className={({ isActive }) => navItemClasses(isActive)}
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

      {/* Main column - FIXED WIDTH ISSUE HERE */}
      <div 
        className={`flex-1 flex flex-col min-h-0 w-full lg:w-[calc(100%-16rem)]`} // <- FIX 1: Explicitly set width on lg screens
      >
        {/* Pass the opener to the header */}
        <ProjectManagerHeader 
          onOpenProfile={() => setShowProfile(true)}
          onMenuClick={() => setSidebarOpen(true)}
        />

        {/* FIXED: Better scroll handling for wide tables */}
        {/* Make this the scrollable container for the main content */}
        <div className="flex-1 min-h-0 overflow-y-auto w-full"> {/* <- FIX 2: Ensure overflow is auto on the content wrapper */}
          <main className="h-full w-full"> {/* Removed redundant overflow-auto from main */}
            <div className="min-h-full w-full">
              {/* FIXED: Remove max-width constraints to allow proper horizontal scrolling */}
              <div className="w-full">
                <div className="px-3 py-4 sm:px-4 sm:py-6 md:px-6 lg:px-8 min-w-0">
                  <NotificationBanner role="Project Manager" />
                  {/* FIXED: Allow content to determine its own width */}
                  <div className="w-full">
                    <Outlet />
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
        
        <ProjectManagerFooter />
      </div>

      {/* Profile Drawer */}
      {showProfile && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/40"
            onClick={() => setShowProfile(false)}
          />
          <aside
            className="fixed right-0 top-0 z-[61] h-full w-full max-w-md bg-white border-l border-neutral-200 shadow-2xl"
            role="dialog"
            aria-modal="true"
          >
            <div className="h-full overflow-y-auto p-4 sm:p-6">
              <ProjectManagerProfile />
            </div>
          </aside>
        </>
      )}
    </div>
  );
}