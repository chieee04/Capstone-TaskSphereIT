import React from "react";
import { Menu, User, NotebookText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import NotiBell from "../common/NotiBell";

const MemberHeader = ({ onOpenProfile }) => {
  const navigate = useNavigate();

  return (
    <header className="bg-white border-b border-neutral-200 shadow-sm">
      <div className="flex items-center justify-between px-6 py-3">
        {/* Left: menu toggle (placeholder) */}
        <div className="flex items-center gap-4">
          <button className="md:hidden p-2 rounded-lg hover:bg-neutral-100">
            <Menu className="w-6 h-6 text-[#6A0F14]" />
          </button>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-4">
          <button
            className="p-2 rounded-full hover:bg-neutral-100 cursor-pointer"
            onClick={() => navigate("/member/notes")}
            title="Notes"
          >
            <NotebookText className="w-6 h-6 text-[#6A0F14]" />
          </button>
          <NotiBell role="Member" to="/member/notifications" />
          <button
            className="p-2 rounded-full hover:bg-neutral-100 cursor-pointer"
            onClick={onOpenProfile}
            aria-label="Open profile"
          >
            <User className="w-6 h-6 text-[#6A0F14]" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default MemberHeader;
