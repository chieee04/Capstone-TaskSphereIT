// src/components/CapstoneAdviser/Events.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ClipboardList,
  BookOpenCheck,
  Presentation,
  GraduationCap,
  Paperclip,
  X,
  Download,
  ExternalLink,
  MoreVertical,
  Edit,
  Check,
  X as CloseIcon,
  ChevronDown,
  Filter,
} from "lucide-react";


import { getAdviserEvents } from "../../services/events";
import { auth } from "../../config/firebase";


/* ===== Firebase ===== */
import { db } from "../../config/firebase";
import {
  doc,
  setDoc,
  updateDoc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  onSnapshot,
  deleteDoc,
  Timestamp
} from "firebase/firestore";


/* ===== Supabase ===== */
import { supabase } from "../../config/supabase";


const MAROON = "#6A0F14";


/** Must match your Firestore collection name */
const MANUSCRIPT_COLLECTION = "manuscriptSubmissions";
const TEAMS_COLLECTION = "teams";
const TITLE_DEFENSE_COLLECTION = "titleDefenseSchedules";
const ORAL_DEFENSE_COLLECTION = "oralDefenseSchedules";
const FINAL_DEFENSE_COLLECTION = "finalDefenseSchedules";
const REFINAL_DEFENSE_COLLECTION = "refinalDefenseSchedules";
const TEAM_SYSTEM_TITLES_COLLECTION = "teamSystemTitles";


const to12h = (t) => {
  if (!t) return "";
  const [Hraw, Mraw] = String(t).split(":");
  const H = Number(Hraw ?? 0);
  const M = Number(Mraw ?? 0);
  const ampm = H >= 12 ? "PM" : "AM";
  const hh = ((H + 11) % 12) + 1;
  return `${hh}:${String(M || 0).padStart(2, "0")} ${ampm}`;
};


const CardTable = ({ children }) => (
  <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-[13px]">{children}</table>
    </div>
  </div>
);


const Pill = ({ children, editable, onClick }) => (
  <span
    onClick={onClick}
    className={`px-3 py-1 rounded-full text-xs inline-flex border border-neutral-300 text-neutral-700 ${
      editable
        ? "cursor-pointer hover:bg-neutral-50 hover:border-neutral-400"
        : ""
    }`}
  >
    {children}
  </span>
);


/* ============ Status Colors ============ */
const STATUS_COLORS = {
  "Pending": "#FFFFFF", // White
  "Passed": "#809D3C", // Green
  "Re-Check": "#578FCA", // Blue
  "Failed": "#3B0304", // Dark Maroon
};


/* ============ Improved Status Dropdown ============ */
function StatusDropdown({ value, row, onSave, canEdit }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);


  const statusOptions = [
    { value: "Pending", label: "Pending", color: STATUS_COLORS.Pending },
    { value: "Passed", label: "Passed", color: STATUS_COLORS.Passed },
    { value: "Re-Check", label: "Re-Check", color: STATUS_COLORS["Re-Check"] },
    { value: "Failed", label: "Failed", color: STATUS_COLORS.Failed },
  ];


  const currentStatus = statusOptions.find(opt => opt.value === value) || statusOptions[0];


  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };


    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


  const handleStatusChange = (newValue) => {
    onSave(row.id, "verdict", newValue);
    setIsOpen(false);
  };


  if (!canEdit) {
    return (
      <span
        className="inline-flex items-center px-3 py-1 rounded text-[12px] font-medium border border-neutral-300"
        style={{
          backgroundColor: currentStatus.color,
          color: currentStatus.value === "Pending" ? "#374151" : "white"
        }}
      >
        {currentStatus.label}
      </span>
    );
  }


  return (
    <div className="relative inline-flex items-center" ref={dropdownRef}>
      <select
        value={value}
        onChange={(e) => handleStatusChange(e.target.value)}
        className="text-[12px] font-medium border border-neutral-300 rounded px-3 py-1 bg-white cursor-pointer appearance-none pr-6"
        style={{
          backgroundColor: currentStatus.color,
          color: currentStatus.value === "Pending" ? "#374151" : "white",
          minWidth: '100px'
        }}
      >
        {statusOptions.map((status) => (
          <option key={status.value} value={status.value} className="text-gray-900 bg-white">
            {status.label}
          </option>
        ))}
      </select>
      <ChevronDown className="w-3 h-3 absolute right-1.5 pointer-events-none" style={{ color: currentStatus.value === "Pending" ? "#374151" : "white" }} />
    </div>
  );
}


/* ============ Improved Percentage Input with Decimal Support ============ */
function PercentageInput({ value, row, field, onSave, canEdit }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(
    typeof value === 'number' ? value.toFixed(2) : "0.00"
  );
  const inputRef = useRef(null);


  useEffect(() => {
    setEditValue(
      typeof value === 'number' ? value.toFixed(2) : "0.00"
    );
  }, [value]);


  const handleSave = () => {
    // Parse the value as float and ensure it's between 0-100
    let finalValue = parseFloat(editValue) || 0;
   
    // Validate range
    if (finalValue < 0) finalValue = 0;
    if (finalValue > 100) finalValue = 100;
   
    // Round to 2 decimal places
    finalValue = Math.round(finalValue * 100) / 100;
   
    onSave(row.id, field, finalValue);
    setIsEditing(false);
  };


  const handleChange = (newValue) => {
    // Allow numbers, decimal point, and backspace
    const decimalRegex = /^\d*\.?\d{0,2}$/;
   
    // Remove any non-numeric characters except decimal point
    let cleanedValue = newValue.replace(/[^\d.]/g, '');
   
    // Ensure only one decimal point
    const decimalParts = cleanedValue.split('.');
    if (decimalParts.length > 2) {
      cleanedValue = decimalParts[0] + '.' + decimalParts.slice(1).join('');
    }
   
    // Limit to 4 digits before decimal and 2 after
    if (decimalParts[0] && decimalParts[0].length > 4) {
      cleanedValue = decimalParts[0].substring(0, 4) + (decimalParts[1] ? '.' + decimalParts[1] : '');
    }
   
    // Limit to 2 decimal places
    if (decimalParts[1] && decimalParts[1].length > 2) {
      cleanedValue = decimalParts[0] + '.' + decimalParts[1].substring(0, 2);
    }
   
    // Don't allow decimal point at the beginning
    if (cleanedValue === '.') {
      cleanedValue = '0.';
    }
   
    // Validate against regex
    if (decimalRegex.test(cleanedValue) || cleanedValue === '') {
      setEditValue(cleanedValue);
    }
  };


  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditValue(typeof value === 'number' ? value.toFixed(2) : "0.00");
    }
  };


  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);


  // Format display value with 2 decimal places
  const displayValue = typeof value === 'number' ? value.toFixed(2) : "0.00";


  if (!canEdit) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-medium text-neutral-800 text-sm">{displayValue}%</span>
      </div>
    );
  }


  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyPress}
            className="w-24 px-3 py-1.5 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-right bg-white"
            style={{ fontSize: '13px' }}
            placeholder="0.00"
          />
          <span className="absolute right-8 top-1/2 transform -translate-y-1/2 text-sm text-neutral-500 pointer-events-none">
            %
          </span>
        </div>
        <button
          onClick={handleSave}
          className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
          title="Save"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            setIsEditing(false);
            setEditValue(typeof value === 'number' ? value.toFixed(2) : "0.00");
          }}
          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
          title="Cancel"
        >
          <CloseIcon className="w-4 h-4" />
        </button>
      </div>
    );
  }


  return (
    <div className="flex items-center gap-2">
      <span className="font-medium text-neutral-800 text-sm">{displayValue}%</span>
      <button
        onClick={() => setIsEditing(true)}
        className="p-1.5 text-neutral-700 rounded transition-all hover:bg-neutral-100"
        title={`Edit ${field === 'plag' ? 'Plagiarism' : 'AI'} score`}
        style={{ color: "#3B0304" }}
      >
        <Edit className="w-4 h-4" />
      </button>
    </div>
  );
}


/* ============ Upload helpers ============ */
const safeName = (name = "") =>
  name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);


async function uploadToSupabase(file, row) {
  const fileKey = `${row.teamId || "no-team"}/${row.id}/${
    Date.now() + "-" + Math.random().toString(36).slice(2)
  }-${safeName(file.name)}`;


  const { error } = await supabase.storage
    .from("user-manuscripts")
    .upload(fileKey, file, { upsert: false });
  if (error) throw new Error(error.message);


  const {
    data: { publicUrl },
  } = supabase.storage.from("user-manuscripts").getPublicUrl(fileKey);


  return {
    name: file.name,
    fileName: fileKey,
    url: publicUrl,
    uploadedAt: new Date().toISOString(),
  };
}


async function upsertFileUrl(docId, nextList) {
  const ref = doc(db, MANUSCRIPT_COLLECTION, docId);
  try {
    await updateDoc(ref, { fileUrl: nextList });
  } catch {
    await setDoc(ref, { fileUrl: nextList }, { merge: true });
  }
}


/* ============ Upload Modal ============ */
function UploadModal({ open, row, onClose, onSaved }) {
  const [pendingFiles, setPendingFiles] = useState([]);
  const [existing, setExisting] = useState([]);
  const [toDelete, setToDelete] = useState(new Set());
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);


  // Initialize when opened
  useEffect(() => {
    if (!open || !row?.id) return;


    // snapshot existing files locally for editing
    setExisting(Array.isArray(row.fileUrl) ? [...row.fileUrl] : []);
    setPendingFiles([]);
    setToDelete(new Set());


    // ensure fileUrl exists remotely too
    (async () => {
      if (!Array.isArray(row.fileUrl)) {
        try {
          await setDoc(
            doc(db, MANUSCRIPT_COLLECTION, row.id),
            { fileUrl: [] },
            { merge: true }
          );
          onSaved?.([]);
        } catch (e) {
          console.error("Init fileUrl failed:", e);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, row?.id]);


  if (!open || !row) return null;


  const pickFiles = () => inputRef.current?.click();


  const onFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setPendingFiles((prev) => [...prev, ...files]);
    e.target.value = "";
  };


  const removePending = (idx) =>
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));


  const removeExisting = (fileName) => {
    setExisting((prev) => prev.filter((f) => f.fileName !== fileName));
    setToDelete((prev) => {
      const next = new Set(prev);
      next.add(fileName);
      return next;
    });
  };


  const save = async () => {
    if (uploading || !row?.id) return;
    setUploading(true);
    try {
      // 1) delete removed existing files from storage
      if (toDelete.size > 0) {
        const names = Array.from(toDelete);
        const { error } = await supabase.storage
          .from("user-manuscripts")
          .remove(names);
        if (error) console.warn("Supabase remove error:", error.message);
      }


      // 2) upload new files
      const uploaded =
        pendingFiles.length > 0
          ? await Promise.all(pendingFiles.map((f) => uploadToSupabase(f, row)))
          : [];


      // 3) compose final list & write to Firestore
      const nextList = [...existing, ...uploaded];
      await upsertFileUrl(row.id, nextList);


      onSaved?.(nextList);
      onClose();
    } catch (e) {
      console.error(e);
      alert(e.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };


  const hasChanges = pendingFiles.length > 0 || toDelete.size > 0;


  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 mx-auto mt-10 w-[880px] max-w-[95vw]">
        <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="h-[2px] w-full" style={{ backgroundColor: MAROON }} />
          <div className="flex items-center justify-between px-5 pt-3 pb-2">
            <div
              className="flex items-center gap-2 text-[16px] font-semibold"
              style={{ color: MAROON }}
            >
              <span>●</span>
              <span>Upload Files — {row.teamName}</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-neutral-100 text-neutral-500"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>


          {/* Body (scrollable) */}
          <div className="flex-1 px-5 pb-5 overflow-y-auto space-y-5">
            {/* Existing files */}
            <div className="rounded-xl border border-neutral-200">
              <div className="px-4 py-2 border-b border-neutral-200 text-sm font-semibold">
                Uploaded Files
              </div>
              <div className="p-4">
                {existing.length > 0 ? (
                  <ul className="space-y-2">
                    {existing.map((f, i) => (
                      <li
                        key={f.fileName || `${f.url}-${i}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2"
                      >
                        <div className="truncate">
                          <div className="text-sm font-medium truncate">
                            {f.name || "file"}
                          </div>
                          <div className="text-xs text-neutral-500 truncate">
                            {f.fileName}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-neutral-300 hover:bg-neutral-50"
                            title="Open"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Open
                          </a>
                          <a
                            href={f.url}
                            download={f.name || "file"}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-neutral-300 hover:bg-neutral-50"
                            title="Download"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download
                          </a>
                          <button
                            type="button"
                            onClick={() => removeExisting(f.fileName)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-neutral-300 hover:bg-neutral-50"
                            title="Remove"
                          >
                            <X className="w-3.5 h-3.5" />
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-neutral-600">
                    There's no uploaded file yet.
                  </div>
                )}
              </div>
            </div>


            {/* Pending attachments */}
            <div className="rounded-xl border border-neutral-200">
              <div className="px-4 py-2 border-b border-neutral-200 text-sm font-semibold flex items-center justify-between">
                <span>Attach Files</span>
                <button
                  type="button"
                  onClick={pickFiles}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm border border-neutral-300 hover:bg-neutral-50"
                >
                  <Paperclip className="w-4 h-4" />
                  Attach file
                </button>
                <input
                  type="file"
                  className="hidden"
                  ref={inputRef}
                  multiple
                  onChange={onFileChange}
                />
              </div>


              <div className="p-4">
                {pendingFiles.length === 0 ? (
                  <div className="text-sm text-neutral-600">
                    No files selected.
                  </div>
                ) : (
                  <ul className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {pendingFiles.map((f, i) => (
                      <li
                        key={`${f.name}-${i}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2"
                      >
                        <div className="truncate">
                          <div className="text-sm font-medium truncate">
                            {f.name}
                          </div>
                          <div className="text-xs text-neutral-500">
                            {(f.size / 1024).toFixed(1)} KB
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removePending(i)}
                          className="p-1 rounded-md hover:bg-neutral-100"
                          title="Remove"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>


          {/* Footer */}
          <div className="flex justify-end gap-2 px-5 pb-4 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-neutral-300 text-sm hover:bg-neutral-100"
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={uploading || !hasChanges}
              className="px-4 py-2 rounded-md text-sm text-white shadow disabled:opacity-50"
              style={{ backgroundColor: MAROON }}
            >
              {uploading ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


// Helper function to get last name from full name
const getLastName = (fullName) => {
  if (!fullName) return "";
  const parts = fullName.trim().split(" ");
  return parts[parts.length - 1] || "";
};


// Helper function to format team name
const formatTeamName = (teamData) => {
  if (teamData.manager && teamData.manager.fullName) {
    const lastName = getLastName(teamData.manager.fullName);
    return `${lastName} etal`;
  }
  return teamData.name || "Unknown Team";
};


/* ============================ Updated Category Card ============================ */
function CategoryCard({ title, icon: Icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer relative w-[160px] h-[220px] rounded-2xl bg-white border-2 border-gray-200 shadow-lg transition-all duration-300
                 hover:shadow-2xl hover:-translate-y-2 hover:border-gray-300 active:scale-[0.98] text-neutral-800 overflow-hidden group"
    >
      {/* Bottom accent only - removed left side accent */}
      <div
        className="absolute bottom-0 left-0 right-0 h-6 rounded-b-2xl transition-all duration-300 group-hover:h-8"
        style={{ background: MAROON }}
      />
     
      {/* Central content area */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-4 pt-2 pb-10">
        {/* Task icon - centered in main white area with animation */}
        <div className="transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
          <Icon className="w-16 h-16 mb-4 text-black" />
        </div>
       
        {/* Title text - positioned below icon */}
        <span className="text-base font-bold text-center leading-tight text-black transition-all duration-300 group-hover:scale-105">
          {title}
        </span>
      </div>


      {/* Subtle glow effect on hover */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
           style={{
             boxShadow: `0 0 20px ${MAROON}40`,
             background: `radial-gradient(circle at center, transparent 0%, ${MAROON}10 100%)`
           }} />
    </button>
  );
}


// Helper function to fetch system titles for teams
const fetchSystemTitlesForTeams = async (teamIds) => {
  const titlesMap = {};
 
  try {
    // Fetch system titles from teamSystemTitles collection
    const titlePromises = teamIds.map(async (teamId) => {
      try {
        const titleDoc = await getDoc(doc(db, TEAM_SYSTEM_TITLES_COLLECTION, teamId));
        if (titleDoc.exists()) {
          const titleData = titleDoc.data();
          titlesMap[teamId] = titleData.systemTitle || "";
        } else {
          titlesMap[teamId] = "";
        }
      } catch (error) {
        console.error(`Error fetching title for team ${teamId}:`, error);
        titlesMap[teamId] = "";
      }
    });


    await Promise.all(titlePromises);
  } catch (error) {
    console.error("Error fetching system titles:", error);
  }


  return titlesMap;
};


// Helper function to check if adviser is panelist in a defense and get the exact panelist name
const isAdviserPanelist = (defenseData, adviserName) => {
  if (!adviserName || !defenseData.panelists) return { isPanelist: false, panelistName: null };
 
  const panelists = Array.isArray(defenseData.panelists)
    ? defenseData.panelists
    : [defenseData.panelists].filter(Boolean);
 
  // Find the exact panelist name that matches the adviser
  const matchingPanelist = panelists.find(panelist =>
    panelist && panelist.toLowerCase().includes(adviserName.toLowerCase())
  );
 
  return {
    isPanelist: !!matchingPanelist,
    panelistName: matchingPanelist || null
  };
};


/* ============================ Filter Dropdown ============================ */
function DefenseFilterDropdown({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);


  const options = [
    { value: "adviser", label: "Adviser" },
    { value: "panelists", label: "Panelists" }
  ];


  const currentOption = options.find(opt => opt.value === value) || options[0];


  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };


    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


  const handleOptionSelect = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
  };


  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-maroon"
        style={{ borderColor: MAROON }}
      >
        <Filter className="w-4 h-4" />
        {currentOption.label}
        <ChevronDown className="w-4 h-4" />
      </button>


      {isOpen && (
        <div className="absolute right-0 z-10 mt-2 w-40 origin-top-right bg-white border border-gray-200 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          <div className="py-1">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => handleOptionSelect(option.value)}
                className={`block w-full text-left px-4 py-2 text-sm ${
                  value === option.value
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


/* ============================ Main ============================ */
export default function AdviserEvents() {
  const [rows, setRows] = useState({
    titleDefense: [],
    manuscript: [],
    oralDefense: [],
    finalDefense: [],
    finalRedefense: [],
  });
  const [allDefenses, setAllDefenses] = useState({
    titleDefense: [],
    oralDefense: [],
    finalDefense: [],
  });
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState(
    (searchParams.get("view") || "menu").toLowerCase()
  );
  const [defTab, setDefTab] = useState(
    (searchParams.get("tab") || "title").toLowerCase()
  );
  const [defenseFilter, setDefenseFilter] = useState("adviser");
  const [adviserName, setAdviserName] = useState("");
  const [adviserTeams, setAdviserTeams] = useState([]);


  // Upload modal state
  const [uploadRow, setUploadRow] = useState(null);


  // Inline editing state
  const [editingCells, setEditingCells] = useState(new Set()); // Set of 'docId-field' strings


  const uid =
    auth?.currentUser?.uid ??
    (typeof window !== "undefined" ? localStorage.getItem("uid") : null);


  // Get adviser's name and teams
  useEffect(() => {
    const fetchAdviserData = async () => {
      if (!uid) return;
     
      try {
        // Get adviser's name
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setAdviserName(userData.fullName || "");
        }


        // Get adviser's teams
        const teamsQuery = query(
          collection(db, TEAMS_COLLECTION),
          where("adviser.uid", "==", uid)
        );
        const teamsSnapshot = await getDocs(teamsQuery);
        const teamsData = teamsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setAdviserTeams(teamsData);
      } catch (error) {
        console.error("Error fetching adviser data:", error);
      }
    };


    fetchAdviserData();
  }, [uid]);


  // Enhanced function to fetch ALL defense schedules including those where adviser is panelist
  const fetchAllDefenseSchedules = async () => {
    try {
      console.log("Fetching ALL defense schedules from separate collections...");


      // Fetch system titles for all teams
      const systemTitlesMap = await fetchSystemTitlesForTeams(adviserTeams.map(team => team.id));


      // Fetch from each collection separately - get ALL documents, not just adviser's teams
      const [titleDefenseSnapshot, oralDefenseSnapshot, finalDefenseSnapshot] = await Promise.all([
        getDocs(collection(db, TITLE_DEFENSE_COLLECTION)),
        getDocs(collection(db, ORAL_DEFENSE_COLLECTION)),
        getDocs(collection(db, FINAL_DEFENSE_COLLECTION))
      ]);


      console.log("Raw defense data counts:", {
        titleDefense: titleDefenseSnapshot.docs.length,
        oralDefense: oralDefenseSnapshot.docs.length,
        finalDefense: finalDefenseSnapshot.docs.length
      });


      // Process defense data for ALL teams (not just adviser's teams)
      const processAllDefenseData = (snapshot, defenseType) => {
        return snapshot.docs
          .filter(doc => {
            const data = doc.data();
            // Include all schedules that have valid schedule data
            return (data.date || data.scheduleDate || data.deadline);
          })
          .map((doc) => {
            const data = doc.data();
           
            // Try to get team data for team name and title
            let currentTeamName = "Unknown Team";
            let currentTeamTitle = "";
            let isAdviserTeam = false;


            if (data.teamId) {
              const adviserTeam = adviserTeams.find(team => team.id === data.teamId);
              if (adviserTeam) {
                currentTeamName = formatTeamName(adviserTeam);
                currentTeamTitle = systemTitlesMap[data.teamId] || adviserTeam.projectTitle || adviserTeam.title || data.title || "";
                isAdviserTeam = true;
              } else {
                // For non-advisory teams, try to fetch team data
                // In a real scenario, you might want to fetch this data
                currentTeamName = data.teamName || "Unknown Team";
                currentTeamTitle = data.title || "";
              }
            }


            // Enhanced panelists extraction
            let panelists = [];
            if (Array.isArray(data.panelists)) {
              panelists = data.panelists;
            } else if (typeof data.panelists === 'string') {
              panelists = [data.panelists];
            } else if (data.panelist) {
              panelists = Array.isArray(data.panelist) ? data.panelist : [data.panelist];
            } else if (data.panelMembers) {
              panelists = Array.isArray(data.panelMembers) ? data.panelMembers : [data.panelMembers];
            } else if (data.panelistsNames) {
              panelists = [data.panelistsNames];
            }


            // Enhanced date extraction
            const date = data.date || data.scheduleDate || data.deadline || data.scheduledDate || "";


            // Enhanced time extraction
            const timeStart = data.timeStart || data.time || data.scheduleTime || data.deadlineTime || data.startTime || "";


            // Enhanced verdict extraction
            const verdict = data.verdict || data.status || data.result || data.outcome || "Pending";


            return {
              id: doc.id,
              ...data,
              defenseType: defenseType,
              teamName: currentTeamName,
              title: currentTeamTitle,
              date: date,
              timeStart: timeStart,
              panelists: panelists,
              verdict: verdict,
              isAdviserTeam: isAdviserTeam,
              teamId: data.teamId
            };
          });
      };


      // Process all defense data
      const allTitleDefense = processAllDefenseData(titleDefenseSnapshot, 'title');
      const allOralDefense = processAllDefenseData(oralDefenseSnapshot, 'oral');
      const allFinalDefense = processAllDefenseData(finalDefenseSnapshot, 'final');


      console.log("All processed defense schedules:", {
        titleDefense: allTitleDefense.length,
        oralDefense: allOralDefense.length,
        finalDefense: allFinalDefense.length
      });


      // Store all defenses for filtering
      setAllDefenses({
        titleDefense: allTitleDefense,
        oralDefense: allOralDefense,
        finalDefense: allFinalDefense
      });


    } catch (error) {
      console.error("Error fetching defense schedules:", error);
      setAllDefenses({
        titleDefense: [],
        oralDefense: [],
        finalDefense: []
      });
    }
  };


  // Get adviser's teams and their manuscript submissions
  const fetchAdviserManuscripts = async () => {
    try {
      setLoading(true);
      console.log("Fetching manuscripts for adviser UID:", uid);


      if (adviserTeams.length === 0) {
        console.log("No teams found for this adviser");
        setRows(prev => ({ ...prev, manuscript: [] }));
        return;
      }


      const adviserTeamIds = adviserTeams.map(team => team.id);


      // Fetch system titles for all teams
      const systemTitlesMap = await fetchSystemTitlesForTeams(adviserTeamIds);


      // Get manuscript submissions for these teams
      const manuscriptsQuery = query(
        collection(db, MANUSCRIPT_COLLECTION),
        where("teamId", "in", adviserTeamIds)
      );


      const manuscriptsSnapshot = await getDocs(manuscriptsQuery);
      const manuscriptsData = manuscriptsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));


      console.log("Raw manuscript data:", manuscriptsData);


      // Process manuscript data with team information
      const processedManuscripts = await Promise.all(
        manuscriptsData.map(async (m) => {
          // Get current team info to ensure we have the latest team name
          let currentTeamName = m.teamName || "Unknown Team";
          let currentTeamTitle = "";
          try {
            const teamDoc = await getDoc(doc(db, TEAMS_COLLECTION, m.teamId));
            if (teamDoc.exists()) {
              const teamData = teamDoc.data();
              currentTeamName = formatTeamName(teamData);
              // Get system title from the titles map we fetched
              currentTeamTitle = systemTitlesMap[m.teamId] || teamData.projectTitle || teamData.title || m.title || "";
            }
          } catch (error) {
            console.error("Error fetching team data:", error);
          }


          // Extract date and time fields - check ALL possible field names
          const date = m.date || m.dueDate || m.submissionDate || m.deadline || "";


          let duetime = "";
          if (m.duetime) duetime = m.duetime;
          else if (m.dueTime) duetime = m.dueTime;
          else if (m.time) duetime = m.time;
          else if (m.submissionTime) duetime = m.submissionTime;
          else if (m.deadlineTime) duetime = m.deadlineTime;
          else if (m.timeStart) duetime = m.timeStart;


          console.log(`Processing manuscript ${m.id}:`, {
            date,
            duetime,
            teamName: currentTeamName,
            title: currentTeamTitle,
            allFields: Object.keys(m)
          });


          return {
            ...m,
            fileUrl: Array.isArray(m.fileUrl) ? m.fileUrl : [],
            duetime: duetime,
            date: date,
            timeStart: duetime, // For compatibility
            teamName: currentTeamName,
            title: currentTeamTitle,
            plag: m.plag || m.plagiarism || 0,
            ai: m.ai || m.aiScore || 0,
            verdict: m.verdict || m.status || "Pending",
          };
        })
      );


      console.log("Processed manuscripts:", processedManuscripts);
      setRows(prev => ({ ...prev, manuscript: processedManuscripts }));


    } catch (error) {
      console.error("Error fetching adviser manuscripts:", error);
      setRows(prev => ({ ...prev, manuscript: [] }));
    } finally {
      setLoading(false);
    }
  };


  // Real-time listener for team and defense schedule changes
  useEffect(() => {
    if (!uid) return;


    // Listen for changes in teams collection
    const teamsQuery = query(
      collection(db, TEAMS_COLLECTION),
      where("adviser.uid", "==", uid)
    );


    const unsubscribeTeams = onSnapshot(teamsQuery, (snapshot) => {
      const updatedTeams = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAdviserTeams(updatedTeams);


      snapshot.docChanges().forEach((change) => {
        if (change.type === 'removed') {
          // Team was dissolved - remove its manuscripts and defense schedules
          const dissolvedTeamId = change.doc.id;
          console.log("Team dissolved, removing data for team:", dissolvedTeamId);


          // Remove manuscripts
          setRows(prev => ({
            ...prev,
            manuscript: prev.manuscript.filter(m => m.teamId !== dissolvedTeamId)
          }));


        } else if (change.type === 'modified') {
          // Team was updated (manager changed, etc.) - update team names
          const updatedTeam = { id: change.doc.id, ...change.doc.data() };
          console.log("Team updated:", updatedTeam);


          // Update team name in manuscripts
          const newTeamName = formatTeamName(updatedTeam);
          const newTeamTitle = updatedTeam.projectTitle || updatedTeam.title || "";


          setRows(prev => ({
            ...prev,
            manuscript: prev.manuscript.map(m =>
              m.teamId === updatedTeam.id
                ? { ...m, teamName: newTeamName }
                : m
            )
          }));
        }
      });
    });


    // Listen for manuscript changes
    const manuscriptsUnsubscribe = onSnapshot(
      collection(db, MANUSCRIPT_COLLECTION),
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'removed') {
            // Manuscript was deleted
            const removedId = change.doc.id;
            setRows(prev => ({
              ...prev,
              manuscript: prev.manuscript.filter(m => m.id !== removedId)
            }));
          }
        });
      }
    );


    // Listen for ALL defense schedule changes from all collections
    const titleDefenseUnsubscribe = onSnapshot(
      collection(db, TITLE_DEFENSE_COLLECTION),
      () => {
        console.log("Title defense schedules changed, refetching...");
        fetchAllDefenseSchedules();
      }
    );


    const oralDefenseUnsubscribe = onSnapshot(
      collection(db, ORAL_DEFENSE_COLLECTION),
      () => {
        console.log("Oral defense schedules changed, refetching...");
        fetchAllDefenseSchedules();
      }
    );


    const finalDefenseUnsubscribe = onSnapshot(
      collection(db, FINAL_DEFENSE_COLLECTION),
      () => {
        console.log("Final defense schedules changed, refetching...");
        fetchAllDefenseSchedules();
      }
    );


    return () => {
      unsubscribeTeams();
      manuscriptsUnsubscribe();
      titleDefenseUnsubscribe();
      oralDefenseUnsubscribe();
      finalDefenseUnsubscribe();
    };
  }, [uid]);


  // Initial data fetch when adviser teams are loaded
  useEffect(() => {
    if (uid && adviserTeams.length > 0) {
      fetchAdviserManuscripts();
      fetchAllDefenseSchedules();
    }
  }, [uid, adviserTeams]);


  // Refresh data when switching to defenses view
  useEffect(() => {
    if (view === "defenses" && uid) {
      console.log("Switched to defenses view, refreshing ALL defense data...");
      fetchAllDefenseSchedules();
    }
  }, [view, uid]);


  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (view === "menu") next.delete("view");
    else next.set("view", view);
    if (view === "defenses") next.set("tab", defTab);
    else next.delete("tab");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, defTab]);


  // FIXED: Updated canEditRow function
  const canEditRow = (row) => {
    const hasDate = !!row.date && row.date.trim() !== "";
    const hasDuetime = !!row.duetime && row.duetime.trim() !== "";


    console.log("canEditRow check for:", row.teamName, {
      date: row.date,
      duetime: row.duetime,
      hasDate,
      hasDuetime,
      canEdit: hasDate && hasDuetime,
    });


    return hasDate && hasDuetime;
  };


  const handleSaveScore = async (docId, field, value) => {
    try {
      const ref = doc(db, MANUSCRIPT_COLLECTION, docId);
      await updateDoc(ref, { [field]: value });


      // Update local state
      setRows((prev) => ({
        ...prev,
        manuscript: prev.manuscript.map((m) =>
          m.id === docId ? { ...m, [field]: value } : m
        ),
      }));


      // Remove from editing set
      setEditingCells((prev) => {
        const next = new Set(prev);
        next.delete(`${docId}-${field}`);
        return next;
      });
    } catch (error) {
      console.error("Failed to update score:", error);
      alert("Failed to update score. Please try again.");
    }
  };


  const handleEditCell = (docId, field) => {
    const row = rows.manuscript.find((m) => m.id === docId);
    if (row && canEditRow(row)) {
      setEditingCells((prev) => new Set(prev).add(`${docId}-${field}`));
    }
  };


  // Filter defense data based on selected filter
  const getFilteredDefenseData = (defenseData) => {
    if (defenseFilter === "adviser") {
      // Show only advisory teams (teams where user is adviser)
      return defenseData.filter(defense => defense.isAdviserTeam);
    } else if (defenseFilter === "panelists" && adviserName) {
      // Show only defenses where user is panelist AND their name appears in panelists list
      return defenseData
        .map(defense => {
          const { isPanelist, panelistName } = isAdviserPanelist(defense, adviserName);
          return { ...defense, isPanelist, panelistName };
        })
        .filter(defense => defense.isPanelist && defense.panelistName);
    }
    return defenseData;
  };


  // Get the currently displayed defense data based on active tab and filter
  const getCurrentDefenseData = () => {
    switch (defTab) {
      case "title":
        // For Title Defense: Always filter by panelist name - only show if adviser name is in panelists
        if (adviserName) {
          return allDefenses.titleDefense
            .map(defense => {
              const { isPanelist, panelistName } = isAdviserPanelist(defense, adviserName);
              return { ...defense, isPanelist, panelistName };
            })
            .filter(defense => defense.isPanelist && defense.panelistName);
        } else {
          return [];
        }
      case "oral":
        return getFilteredDefenseData(allDefenses.oralDefense);
      case "final":
        return getFilteredDefenseData(allDefenses.finalDefense);
      default:
        return [];
    }
  };


  const currentDefenseData = getCurrentDefenseData();


  /* ===== Updated Header to match ProjectManagerTasks ===== */
  const Header = (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[18px] font-semibold text-black">
        <ClipboardList className="w-5 h-5" />
        <span>Events</span>
      </div>
      {/* Divider with rounded edges - matching ProjectManagerTasks */}
      <div className="h-1 w-full rounded-full" style={{ backgroundColor: MAROON }} />
    </div>
  );


  if (view === "menu") {
    return (
      <div className="space-y-4">
        {Header}
        <div className="flex flex-wrap gap-6">
          <CategoryCard
            title="Manuscript Results"
            icon={BookOpenCheck}
            onClick={() => setView("manuscript")}
          />
          <CategoryCard
            title="Capstone Defenses"
            icon={Presentation}
            onClick={() => setView("defenses")}
          />
        </div>
      </div>
    );
  }


  return (
    <div className="space-y-4">
      {Header}


      {view === "manuscript" && (
        <section>
          {/* Instructions */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> You can only edit scores and status when a
              due date and due time are set by the instructor. The edit icons are always visible for editable fields.
            </p>
          </div>


          {rows.manuscript.length === 0 && !loading ? (
            <div className="text-center py-8 text-neutral-500">
              No manuscript submissions found for your teams.
            </div>
          ) : (
            <CardTable>
              <thead>
                <tr className="bg-neutral-50/80 text-neutral-600">
                  <th className="text-left py-2 pl-6 pr-3">NO</th>
                  <th className="text-left py-2 pr-3">Team</th>
                  <th className="text-left py-2 pr-3">Title</th>
                  <th className="text-left py-2 pr-3">Due Date</th>
                  <th className="text-left py-2 pr-3">Due Time</th>
                  <th className="text-left py-2 pr-3">Plagiarism</th>
                  <th className="text-left py-2 pr-3">AI</th>
                  <th className="text-left py-2 pr-3">Status</th>
                  <th className="text-left py-2 pr-3">File Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {(loading ? [] : rows.manuscript).map((r, idx) => {
                  const canEdit = canEditRow(r);


                  console.log("Rendering row:", {
                    id: r.id,
                    teamName: r.teamName,
                    title: r.title,
                    date: r.date,
                    duetime: r.duetime,
                    canEdit,
                  });


                  return (
                    <tr
                      key={`ms-${r.id}`}
                      className="border-t border-neutral-200"
                    >
                      <td className="py-2 pl-6 pr-3">{idx + 1}.</td>
                      <td className="py-2 pr-3">{r.teamName}</td>
                      <td className="py-2 pr-3">{r.title || "—"}</td>
                      <td className="py-2 pr-3">
                        {r.date || (
                          <span className="text-red-500 text-xs">Not set</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {r.duetime ? (
                          to12h(r.duetime)
                        ) : (
                          <span className="text-red-500 text-xs">Not set</span>
                        )}
                      </td>


                      {/* Plagiarism Score - Improved UI with Decimal Support */}
                      <td className="py-2 pr-3">
                        <PercentageInput
                          value={r.plag}
                          row={r}
                          field="plag"
                          onSave={handleSaveScore}
                          canEdit={canEdit}
                        />
                      </td>


                      {/* AI Score - Improved UI with Decimal Support */}
                      <td className="py-2 pr-3">
                        <PercentageInput
                          value={r.ai}
                          row={r}
                          field="ai"
                          onSave={handleSaveScore}
                          canEdit={canEdit}
                        />
                      </td>


                      {/* Status - Improved Dropdown */}
                      <td className="py-2 pr-3">
                        <StatusDropdown
                          value={r.verdict}
                          row={r}
                          onSave={handleSaveScore}
                          canEdit={canEdit}
                        />
                      </td>


                      {/* Upload button + modal */}
                      <td className="py-2 pr-3">
                        <button
                          type="button"
                          onClick={() => setUploadRow(r)}
                          className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
                        >
                          <Paperclip className="w-4 h-4" />
                          Upload File
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </CardTable>
          )}


          {/* Upload Modal */}
          <UploadModal
            open={!!uploadRow}
            row={uploadRow}
            onClose={() => setUploadRow(null)}
            onSaved={(newList) => {
              setRows((prev) => ({
                ...prev,
                manuscript: (prev.manuscript || []).map((m) =>
                  m.id === uploadRow?.id ? { ...m, fileUrl: newList } : m
                ),
              }));
              setUploadRow((old) => (old ? { ...old, fileUrl: newList } : old));
            }}
          />
        </section>
      )}


      {view === "defenses" && (
        <>
          <div className="flex justify-between items-center mb-3">
            <div className="flex gap-2">
              {[
                { key: "title", label: "Title Defense" },
                { key: "oral", label: "Oral Defense" },
                { key: "final", label: "Final Defense" },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setDefTab(t.key)}
                  className={`px-3 py-1.5 rounded-md text-sm border ${
                    defTab === t.key ? "text-white" : "text-neutral-700"
                  }`}
                  style={defTab === t.key ? { backgroundColor: MAROON } : {}}
                >
                  {t.label}
                </button>
              ))}
            </div>
           
            {/* Filter Dropdown - Hide for Title Defense */}
            {defTab !== "title" && (
              <DefenseFilterDropdown
                value={defenseFilter}
                onChange={setDefenseFilter}
              />
            )}
          </div>


          {/* Defense Tables */}
          {defTab === "title" && (
            <section>
              <CardTable>
                <thead>
                  <tr className="bg-neutral-50/80 text-neutral-600">
                    <th className="text-left py-2 pl-6 pr-3">NO</th>
                    <th className="text-left py-2 pr-3">Team</th>
                    <th className="text-left py-2 pr-3">Title</th>
                    <th className="text-left py-2 pr-3">Date</th>
                    <th className="text-left py-2 pr-3">Time</th>
                    <th className="text-left py-2 pr-3">Panelist</th>
                    <th className="text-left py-2 pr-6">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {currentDefenseData.map((r, idx) => (
                    <tr
                      key={`td-${r.id}`}
                      className="border-t border-neutral-200"
                    >
                      <td className="py-2 pl-6 pr-3">{idx + 1}.</td>
                      <td className="py-2 pr-3">{r.teamName}</td>
                      <td className="py-2 pr-3">{r.title || "—"}</td>
                      <td className="py-2 pr-3">{r.date || "—"}</td>
                      <td className="py-2 pr-3">
                        {r.timeStart ? to12h(r.timeStart) : "—"}
                      </td>
                      <td className="py-2 pr-3">
                        {r.panelistName ? (
                          <span className="font-medium text-blue-700">
                            {r.panelistName}
                          </span>
                        ) : (
                          Array.isArray(r.panelists) && r.panelists.length > 0
                            ? r.panelists.join(", ")
                            : "—"
                        )}
                      </td>
                      <td className="py-2 pr-6">
                        <Pill>{r.verdict || "Pending"}</Pill>
                      </td>
                    </tr>
                  ))}
                  {currentDefenseData.length === 0 && !loading && (
                    <tr className="border-t border-neutral-200">
                      <td
                        className="py-6 text-center text-neutral-500"
                        colSpan={7}
                      >
                        No title defense schedules found where you are a panelist.
                      </td>
                    </tr>
                  )}
                </tbody>
              </CardTable>
            </section>
          )}


          {defTab === "oral" && (
            <section>
              <CardTable>
                <thead>
                  <tr className="bg-neutral-50/80 text-neutral-600">
                    <th className="text-left py-2 pl-6 pr-3">NO</th>
                    <th className="text-left py-2 pr-3">Team</th>
                    <th className="text-left py-2 pr-3">Title</th>
                    <th className="text-left py-2 pr-3">Date</th>
                    <th className="text-left py-2 pr-3">Time</th>
                    <th className="text-left py-2 pr-3">Panelist</th>
                    <th className="text-left py-2 pr-6">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {currentDefenseData.map((r, idx) => (
                    <tr
                      key={`od-${r.id}`}
                      className="border-t border-neutral-200"
                    >
                      <td className="py-2 pl-6 pr-3">{idx + 1}.</td>
                      <td className="py-2 pr-3">{r.teamName}</td>
                      <td className="py-2 pr-3">{r.title || "—"}</td>
                      <td className="py-2 pr-3">{r.date || "—"}</td>
                      <td className="py-2 pr-3">
                        {r.timeStart ? to12h(r.timeStart) : "—"}
                      </td>
                      <td className="py-2 pr-3">
                        {defenseFilter === "panelists" && r.panelistName ? (
                          // In panelist mode, show only the adviser's panelist name
                          <span className="font-medium text-blue-700">
                            {r.panelistName}
                          </span>
                        ) : (
                          // In adviser mode, show all panelists
                          Array.isArray(r.panelists) && r.panelists.length > 0
                            ? r.panelists.join(", ")
                            : "—"
                        )}
                      </td>
                      <td className="py-2 pr-6">
                        <Pill>{r.verdict || "Pending"}</Pill>
                      </td>
                    </tr>
                  ))}
                  {currentDefenseData.length === 0 && !loading && (
                    <tr className="border-t border-neutral-200">
                      <td
                        className="py-6 text-center text-neutral-500"
                        colSpan={7}
                      >
                        {defenseFilter === "adviser"
                          ? "No oral defense schedules found for your advisory teams."
                          : "No oral defense schedules found where you are a panelist."
                        }
                      </td>
                    </tr>
                  )}
                </tbody>
              </CardTable>
            </section>
          )}


          {defTab === "final" && (
            <section>
              <CardTable>
                <thead>
                  <tr className="bg-neutral-50/80 text-neutral-600">
                    <th className="text-left py-2 pl-6 pr-3">NO</th>
                    <th className="text-left py-2 pr-3">Team</th>
                    <th className="text-left py-2 pr-3">Title</th>
                    <th className="text-left py-2 pr-3">Date</th>
                    <th className="text-left py-2 pr-3">Time</th>
                    <th className="text-left py-2 pr-3">Panelist</th>
                    <th className="text-left py-2 pr-6">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {currentDefenseData.length ? (
                    currentDefenseData.map((r, idx) => (
                      <tr
                        key={`fd-${r.id}`}
                        className="border-t border-neutral-200"
                      >
                        <td className="py-2 pl-6 pr-3">{idx + 1}.</td>
                        <td className="py-2 pr-3">{r.teamName}</td>
                        <td className="py-2 pr-3">{r.title || "—"}</td>
                        <td className="py-2 pr-3">{r.date || "—"}</td>
                        <td className="py-2 pr-3">
                          {r.timeStart ? to12h(r.timeStart) : "—"}
                        </td>
                        <td className="py-2 pr-3">
                          {defenseFilter === "panelists" && r.panelistName ? (
                            // In panelist mode, show only the adviser's panelist name
                            <span className="font-medium text-blue-700">
                              {r.panelistName}
                            </span>
                          ) : (
                            // In adviser mode, show all panelists
                            Array.isArray(r.panelists) && r.panelists.length > 0
                              ? r.panelists.join(", ")
                              : "—"
                          )}
                        </td>
                        <td className="py-2 pr-6">
                          <Pill>{r.verdict || "Pending"}</Pill>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr className="border-t border-neutral-200">
                      <td
                        className="py-6 text-center text-neutral-500"
                        colSpan={7}
                      >
                        {defenseFilter === "adviser"
                          ? "No final defense schedules found for your advisory teams."
                          : "No final defense schedules found where you are a panelist."
                        }
                      </td>
                    </tr>
                  )}
                </tbody>
              </CardTable>
            </section>
          )}
        </>
      )}
    </div>
  );
}


