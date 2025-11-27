// src/components/CapstoneAdviser/AdviserHeader.jsx
import React from "react";
import { Menu, User, NotebookText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import NotiBell from "../common/NotiBell";


const AdviserHeader = ({ onProfileClick, onMenuClick }) => {
  const navigate = useNavigate();


  return (
    <header className="bg-white border-b border-neutral-200 shadow-sm">
      <div className="flex items-center justify-between px-3 py-3 sm:px-4 md:px-6 lg:px-8">
        {/* Left: menu toggle - visible on tablet and mobile (lg and below) */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg hover:bg-neutral-100 transition-colors flex-shrink-0"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5 text-[#6A0F14]" />
          </button>
          {/* Logo for mobile/tablet when sidebar is hidden */}
          <div className="lg:hidden flex items-center flex-shrink-0">
            <span className="text-base font-semibold text-[#6A0F14] whitespace-nowrap">TaskSphere</span>
          </div>
        </div>


        {/* Right: actions - Ensure icons are always visible */}
        <div className="flex items-center gap-1 sm:gap-2 md:gap-3 flex-shrink-0">
          <button
            className="p-1.5 sm:p-2 rounded-full hover:bg-neutral-100 cursor-pointer transition-colors flex-shrink-0"
            onClick={() => navigate("/adviser/notes")}
            aria-label="Notes"
          >
            <NotebookText className="w-4 h-4 sm:w-5 sm:h-5 text-[#6A0F14]" />
          </button>
          <div className="flex-shrink-0">
            <NotiBell role="Adviser" to="/adviser/notifications" />
          </div>
          <button
            className="p-1.5 sm:p-2 rounded-full hover:bg-neutral-100 cursor-pointer transition-colors flex-shrink-0"
            onClick={onProfileClick}
            aria-label="Open profile"
          >
            <User className="w-4 h-4 sm:w-5 sm:h-5 text-[#6A0F14]" />
          </button>
        </div>
      </div>
    </header>
  );
};


export default AdviserHeader;


