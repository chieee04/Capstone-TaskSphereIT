// src/components/CapstoneInstructor/InstructorSchedule/TitleDefense.jsx
import React, { useEffect, useMemo, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Download,
  MoreVertical,
  Calendar as CalIcon,
  Calendar,
  Clock,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  User2,
  X,
  PlusCircle,
  Check,
  X as CloseIcon,
  Filter,
  RotateCcw,
  Trash2,
} from "lucide-react";
import Swal from "sweetalert2";
 
/* ===== Firestore ===== */
import { db } from "../../../config/firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  addDoc,
} from "firebase/firestore";
import { notifyTeamSchedule } from "../../../services/notifications";
 
/* ===== PDF ===== */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
 
/* ---- logos for PDF (DCT left, CCS right, TaskSphere footer-left) ---- */
import DCTLOGO from "../../../assets/imgs/pdf imgs/DCTLOGO.png";
import CCSLOGO from "../../../assets/imgs/pdf imgs/CCSLOGO.png";
import TASKSPHERELOGO from "../../../assets/imgs/pdf imgs/TASKSPHERELOGO.png";
 
const MAROON = "#6A0F14";
 
/* ===== helpers ===== */
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const fmtDate = (yyyy_mm_dd) => {
  if (!yyyy_mm_dd) return "";
  const [y, m, d] = yyyy_mm_dd.split("-");
  return `${MONTHS[Number(m) - 1]} ${Number(d)}, ${y}`;
};
 
const fmtTime = (time) => {
  const isBlankish = (v) =>
    v == null || ["", "-", "—", "——"].includes(String(v).trim());
  const to12h = (t) => {
    if (isBlankish(t)) return "";
    const [H, M] = String(t).split(":").map(Number);
    if (Number.isNaN(H) || Number.isNaN(M)) return "";
    const ampm = H >= 12 ? "PM" : "AM";
    const hh = ((H + 11) % 12) + 1;
    return `${hh}:${String(M).padStart(2, "0")} ${ampm}`;
  };
  return to12h(time);
};
 
// Generate time options with 30-minute intervals
const generateTimeOptions = () => {
  const times = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeString = `${hour.toString().padStart(2, "0")}:${minute
        .toString()
        .padStart(2, "0")}`;
      times.push(timeString);
    }
  }
  return times;
};
 
const TIME_OPTIONS = generateTimeOptions();
 
// Check if date has passed (including time) - for verdict editing
const isDatePassed = (dateStr, timeStr) => {
  if (!dateStr) return false;
 
  const now = new Date();
  const scheduleDateTime = new Date(dateStr);
 
  if (timeStr) {
    const [hours, minutes] = timeStr.split(":").map(Number);
    scheduleDateTime.setHours(hours, minutes, 0, 0);
  } else {
    scheduleDateTime.setHours(23, 59, 59, 999); // End of day if no time
  }
 
  return scheduleDateTime < now;
};
 
// Get current date in YYYY-MM-DD format for min date
const getCurrentDate = () => {
  return new Date().toISOString().split("T")[0];
};
 
// Format date and time for display in error messages
const formatDateTimeForDisplay = (dateStr, timeStr) => {
  if (!dateStr) return "No date selected";
 
  const date = new Date(dateStr);
  const formattedDate = fmtDate(dateStr);
 
  if (timeStr) {
    const formattedTime = fmtTime(timeStr);
    return `${formattedDate} ${formattedTime}`;
  } else {
    return formattedDate;
  }
};
 
const Breadcrumbs = () => {
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-2 text-neutral-700">
      <button
        onClick={() => navigate("/instructor/schedule")}
        className="text-[15px] font-medium text-neutral-600 hover:underline"
      >
        Schedule
      </button>
      <ChevronRight size={16} className="text-neutral-400" />
      <span className="text-[15px] font-semibold">Title Defense</span>
      <ChevronRight size={16} className="text-neutral-400" />
      <span className="text-[15px]">Scheduled Teams</span>
    </div>
  );
};
 
export default function TitleDefense() {
  const navigate = useNavigate();
  const [queryText, setQueryText] = useState("");
  const [filterVerdict, setFilterVerdict] = useState("all");
 
  const [editingId, setEditingId] = useState(null);
  const [viewSchedule, setViewSchedule] = useState(null);
 
  /* ===== Firestore-backed options ===== */
  const [teamOptions, setTeamOptions] = useState([]); // [{id, name}]
  const [loadingTeams, setLoadingTeams] = useState(true);
 
  const [adviserOptions, setAdviserOptions] = useState([]); // ["Full Name", ...]
  const [loadingAdvisers, setLoadingAdvisers] = useState(true);
 
  /* ===== Schedules list ===== */
  const [schedules, setSchedules] = useState([]); // [{id, ...}]
  const [loadingSchedules, setLoadingSchedules] = useState(true);
 
  // Row menu
  const [menuOpenId, setMenuOpenId] = useState(null);
 
  // Filter dropdown state
  const [filterOpen, setFilterOpen] = useState(false);
 
  // Tooltip state for verdict
  const [showVerdictTooltip, setShowVerdictTooltip] = useState(null);
 
  /* ===== Bulk delete state ===== */
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
 
  const exitBulk = () => {
    setBulkMode(false);
    setSelected(new Set());
  };
  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
 
  // Show tooltip for 5 seconds
  const showTooltipFor5Sec = (scheduleId) => {
    setShowVerdictTooltip(scheduleId);
    setTimeout(() => {
      setShowVerdictTooltip(null);
    }, 5000);
  };
 
  // Show SweetAlert for various messages
  const showAlert = (title, text, icon = "info") => {
    Swal.fire({
      title,
      text,
      icon,
      confirmButtonColor: MAROON,
    });
  };
 
  // Load Advisers from users where role == "Adviser"
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const qUsers = query(
          collection(db, "users"),
          where("role", "==", "Adviser")
        );
        const snap = await getDocs(qUsers);
        const names = [];
        snap.forEach((docX) => {
          const d = docX.data() || {};
          const full = [d.firstName, d.middleName, d.lastName]
            .filter(Boolean)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
          if (full) names.push(full);
        });
        names.sort((a, b) => a.localeCompare(b));
        if (!alive) return;
        setAdviserOptions(names);
      } catch (e) {
        console.error("Failed to load advisers from users:", e);
        showAlert(
          "Error",
          "Failed to load advisers. Please try again.",
          "error"
        );
      } finally {
        if (alive) setLoadingAdvisers(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
 
  // Button Component
  const Btn = ({
    children,
    variant = "solid",
    icon: Icon,
    className = "",
    ...props
  }) => {
    const base =
      "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium cursor-pointer " +
      "focus:outline-none focus:ring-2 focus:ring-neutral-200 " +
      className;
 
    const cls =
      variant === "solid"
        ? base + " text-white"
        : base +
          " border border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-50";
 
    const style = variant === "solid" ? { backgroundColor: MAROON } : undefined;
    return (
      <button {...props} className={cls} style={style}>
        {Icon && <Icon size={16} />}
        {children}
      </button>
    );
  };
 
  // Function to get project manager's last name and format as "Lastname Et Al"
  const getProjectManagerLastNameEtAl = async (teamId) => {
    try {
      const teamDoc = await getDoc(doc(db, "teams", teamId));
      if (!teamDoc.exists()) {
        return "Team Deleted";
      }
 
      const teamData = teamDoc.data();
 
      // Get project manager data - check different possible structures
      const projectManager = teamData?.manager;
 
      if (projectManager) {
        // Try different possible field names for last name
        const lastName = projectManager.lastName || 
                        projectManager.lastname || 
                        (projectManager.fullName ? projectManager.fullName.split(' ').pop() : null);
 
        if (lastName) {
          // Format as "Lastname Et Al"
          return `${lastName} Et Al`;
        }
      }
 
      // Fallback to team name if no project manager data
      return teamData?.teamName || "Unknown Team";
    } catch (error) {
      console.error("Error fetching project manager data:", error);
      return "Team Deleted";
    }
  };
 
  // Function to get manager's last name by fetching manager user data
  const getManagerLastNameFromUser = async (teamId) => {
    try {
      const teamDoc = await getDoc(doc(db, "teams", teamId));
      if (!teamDoc.exists()) {
        return "Team Deleted";
      }
 
      const teamData = teamDoc.data();
 
      // Get manager UID from team data
      const managerUid = teamData?.managerUid || 
                        (teamData?.manager ? teamData.manager.uid : null);
 
      if (managerUid) {
        // Fetch manager user data
        const managerDoc = await getDoc(doc(db, "users", managerUid));
        if (managerDoc.exists()) {
          const managerData = managerDoc.data();
          const lastName = managerData?.lastName || managerData?.lastname;
 
          if (lastName) {
            return `${lastName} Et Al`;
          }
        }
      }
 
      // Fallback to checking teamData.manager directly
      const projectManager = teamData?.manager;
      if (projectManager) {
        const lastName = projectManager.lastName || projectManager.lastname;
        if (lastName) {
          return `${lastName} Et Al`;
        }
      }
 
      // Final fallback
      return teamData?.teamName || "Unknown Team";
    } catch (error) {
      console.error("Error fetching manager user data:", error);
      return "Team Deleted";
    }
  };
 
  // Load Schedules with project manager's last name + "Et Al"
  const loadSchedules = async () => {
    setLoadingSchedules(true);
    try {
      const snap = await getDocs(collection(db, "titleDefenseSchedules"));
      const rows = [];
      const teamIdsToFetch = new Set();
 
      snap.forEach((docX) => {
        const data = docX.data();
        const row = {
          id: docX.id,
          teamName: data?.teamName || "",
          teamId: data?.teamId || null,
          date: data?.date || "",
          time: data?.time || "",
          panelists: Array.isArray(data?.panelists) ? data.panelists : [],
          verdict: data?.verdict || "Pending",
          createdAt: data?.createdAt,
          isRePresentation: data?.isRePresentation || false,
          originalScheduleId: data?.originalScheduleId || null,
          teamDisplay: null,
        };
        rows.push(row);
        if (row.teamId) {
          teamIdsToFetch.add(row.teamId);
        }
      });
 
      // Fetch all team documents and get project manager's last name
      const teamDisplayPromises = Array.from(teamIdsToFetch).map(async (teamId) => {
        // Try both methods to get manager's last name
        let displayName = await getManagerLastNameFromUser(teamId);
 
        // If still "Unknown Team", try the other method
        if (displayName === "Unknown Team") {
          displayName = await getProjectManagerLastNameEtAl(teamId);
        }
 
        return { teamId, displayName };
      });
 
      const teamDisplayResults = await Promise.all(teamDisplayPromises);
      const teamDataMap = {};
 
      teamDisplayResults.forEach(({ teamId, displayName }) => {
        teamDataMap[teamId] = displayName;
      });
 
      // Update schedules with project manager's last name + "Et Al"
      const finalRows = rows
        .map((row) => ({
          ...row,
          // Use project manager's last name + "Et Al" format
          teamDisplay: row.teamId
            ? teamDataMap[row.teamId] || "Team Deleted"
            : "No Team ID",
        }))
        // Filter out schedules where team has been deleted/dissolved
        .filter((row) => {
          if (!row.teamId) return true; // Keep schedules without team ID
          return teamDataMap[row.teamId] !== "Team Deleted"; // Remove if team doesn't exist
        });
 
      // Sort by date and time
      finalRows.sort((a, b) => {
        if (a.date && b.date) {
          const dateCompare = a.date.localeCompare(b.date);
          if (dateCompare !== 0) return dateCompare;
          return (a.time || "").localeCompare(b.time || "");
        }
        return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
      });
 
      setSchedules(finalRows);
    } catch (e) {
      console.error("Failed to load schedules:", e);
      showAlert(
        "Error",
        "Failed to load schedules. Please try again.",
        "error"
      );
    } finally {
      setLoadingSchedules(false);
    }
  };
 
  // Set up real-time listener for teams to detect changes
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "teams"), () => {
      // When teams change, reload schedules to reflect updated team names
      loadSchedules();
    });
 
    return () => unsubscribe();
  }, []);
 
  // Initial load
  useEffect(() => {
    loadSchedules();
  }, []);
 
  // verdict updater
  const handleChangeVerdict = async (scheduleId, newVerdict) => {
    try {
      setSchedules((prev) =>
        prev.map((s) =>
          s.id === scheduleId ? { ...s, verdict: newVerdict } : s
        )
      );
      await updateDoc(doc(db, "titleDefenseSchedules", scheduleId), {
        verdict: newVerdict,
      });
      showAlert("Success", "Verdict updated successfully.", "success");
    } catch (e) {
      console.error("Failed to update verdict:", e);
      await loadSchedules();
      showAlert(
        "Error",
        "Failed to update verdict. Please try again.",
        "error"
      );
    }
  };
 
  // Handle inline edit save
  const handleSaveEdit = async (scheduleId, updatedData) => {
    try {
      // Validate all required fields
      if (!updatedData.date) {
        showAlert("Required Field", "Please select a date.", "warning");
        return;
      }
      if (!updatedData.time) {
        showAlert("Required Field", "Please select a time.", "warning");
        return;
      }
      if (updatedData.panelists.length === 0) {
        showAlert(
          "Required Field",
          "Please add at least one panelist.",
          "warning"
        );
        return;
      }
 
      const selected = teamOptions.find((t) => t.name === updatedData.teamName);
      const teamId = selected?.id || null;
 
      const payload = {
        teamId,
        teamName: updatedData.teamName,
        date: updatedData.date,
        time: updatedData.time,
        panelists: Array.isArray(updatedData.panelists)
          ? updatedData.panelists
          : [],
      };
 
      await updateDoc(doc(db, "titleDefenseSchedules", scheduleId), payload);
 
      // Notify team (PM, Adviser, Members)
      await notifyTeamSchedule({
        kind: "Title Defense",
        teamId,
        teamName: updatedData.teamName,
        date: updatedData.date,
        time: updatedData.time,
      });
 
      setEditingId(null);
      await loadSchedules();
      showAlert("Success", "Schedule updated successfully.", "success");
    } catch (err) {
      console.error("Failed to update schedule:", err);
      showAlert("Error", "Operation failed. Please try again.", "error");
      await loadSchedules();
    }
  };
 
  // Handle schedule re-presentation
  const handleScheduleRePresentation = async (originalSchedule) => {
    try {
      const newSchedule = {
        teamId: originalSchedule.teamId,
        teamName: originalSchedule.teamName,
        date: "", // Empty date for re-presentation
        time: "", // Empty time for re-presentation
        panelists: [], // Empty array - NO panelists copied for re-presentation
        verdict: "Pending",
        createdAt: new Date(),
        isRePresentation: true,
        originalScheduleId: originalSchedule.id,
      };
 
      await addDoc(collection(db, "titleDefenseSchedules"), newSchedule);
 
      setMenuOpenId(null);
      await loadSchedules();
 
      showAlert(
        "Success",
        "Re-presentation scheduled successfully. Please set the new date, time, and panelists.",
        "success"
      );
    } catch (err) {
      console.error("Failed to schedule re-presentation:", err);
      showAlert(
        "Error",
        "Failed to schedule re-presentation. Please try again.",
        "error"
      );
    }
  };
 
  // Handle individual schedule deletion
  const handleDeleteSchedule = async (schedule) => {
    const result = await Swal.fire({
      title: "Confirm Delete",
      text: `Delete schedule for team "${schedule.teamDisplay || schedule.teamName}"? This cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: MAROON,
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "Cancel",
    });
 
    if (!result.isConfirmed) return;
 
    try {
      await deleteDoc(doc(db, "titleDefenseSchedules", schedule.id));
      setMenuOpenId(null);
      await loadSchedules();
      showAlert("Success", "Schedule deleted successfully.", "success");
    } catch (err) {
      console.error("Failed to delete schedule:", err);
      showAlert(
        "Error",
        "Failed to delete schedule. Please try again.",
        "error"
      );
    }
  };
 
  // Check if verdict can be edited (date must be passed AND verdict is not "Approved")
  const canEditVerdict = (schedule) => {
    return isDatePassed(schedule.date, schedule.time) && schedule.verdict !== "Approved";
  };
 
  // Check if schedule details can be edited (verdict must not be "Approved")
  const canEditSchedule = (schedule) => {
    return schedule.verdict !== "Approved";
  };
 
  // search filter (client-side) - search both team name and team display name
  const filtered = useMemo(() => {
    let result = schedules;
 
    // Apply verdict filter
    if (filterVerdict !== "all") {
      result = result.filter((s) => s.verdict === filterVerdict);
    }
 
    // Apply search text filter - searches team name OR the team display name
    const q = queryText.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (t) =>
          t.teamName.toLowerCase().includes(q) ||
          t.teamDisplay?.toLowerCase().includes(q)
      );
    }
 
    return result;
  }, [queryText, filterVerdict, schedules]);
 
  // Select-all works on the filtered (visible) list
  const allVisibleIds = useMemo(() => filtered.map((s) => s.id), [filtered]);
  const allSelected =
    selected.size > 0 && allVisibleIds.every((id) => selected.has(id));
  const toggleSelectAll = () => {
    setSelected((prev) => (allSelected ? new Set() : new Set(allVisibleIds)));
  };
 
  // Delete button behavior
  const handleBulkDeleteClick = async () => {
    if (!bulkMode) {
      setBulkMode(true);
      return;
    }
    if (selected.size === 0) {
      showAlert(
        "Selection Required",
        "Select at least one schedule to delete.",
        "warning"
      );
      return;
    }
 
    const result = await Swal.fire({
      title: "Confirm Delete",
      text: `Delete ${selected.size} selected schedule(s)? This cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: MAROON,
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "Cancel",
    });
 
    if (!result.isConfirmed) return;
 
    try {
      await Promise.all(
        Array.from(selected).map((id) =>
          deleteDoc(doc(db, "titleDefenseSchedules", id))
        )
      );
      exitBulk();
      await loadSchedules();
      showAlert(
        "Success",
        `${selected.size} schedule(s) deleted successfully.`,
        "success"
      );
    } catch (e) {
      console.error("Bulk delete failed:", e);
      showAlert(
        "Error",
        "Failed to delete some schedules. Please try again.",
        "error"
      );
      await loadSchedules();
    }
  };
 
  /* ===== PDF export with SweetAlert dropdown ===== */
  const loadImage = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
 
  const handleExportPDF = async () => {
    const { value: exportFilter } = await Swal.fire({
      title: "Export PDF",
      text: "Choose which schedules to export:",
      icon: "question",
      input: "select",
      inputOptions: {
        all: "All Schedule",
        Pending: "Pending",
        Approved: "Approved",
        "Re-Present": "Re-Present",
        Failed: "Failed",
      },
      inputValue: "all",
      showCancelButton: true,
      confirmButtonText: "Export",
      cancelButtonText: "Cancel",
      confirmButtonColor: MAROON,
    });
 
    if (!exportFilter) return;
 
    // Filter data based on selection
    let exportData = schedules;
    if (exportFilter !== "all") {
      exportData = schedules.filter((s) => s.verdict === exportFilter);
    }
 
    if (exportData.length === 0) {
      Swal.fire({
        title: "No Data",
        text: `No ${
          exportFilter === "all" ? "" : exportFilter + " "
        }schedules found to export.`,
        icon: "warning",
        confirmButtonColor: MAROON,
      });
      return;
    }
 
    const title = `Title Defense Schedule - ${
      exportFilter === "all" ? "All" : exportFilter
    }`;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 40;
 
    // preload images
    let dctImg, ccsImg, tsImg;
    try {
      [dctImg, ccsImg, tsImg] = await Promise.all([
        loadImage(DCTLOGO),
        loadImage(CCSLOGO),
        loadImage(TASKSPHERELOGO),
      ]);
    } catch {
      // continue even if images fail to load
    }
 
    const drawHeader = () => {
      const topY = 24;
 
      if (dctImg) {
        const sideW = 64;
        const sideH = (dctImg.height / dctImg.width) * sideW;
        doc.addImage(dctImg, "PNG", marginX, topY, sideW, sideH);
      }
      if (ccsImg) {
        const sideW = 64;
        const sideH = (ccsImg.height / ccsImg.width) * sideW;
        doc.addImage(
          ccsImg,
          "PNG",
          pageWidth - marginX - sideW,
          topY,
          sideW,
          sideH
        );
      }
 
      const headerY = 92;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("DOMINICAN COLLEGE OF TARLAC, INC.", pageWidth / 2, headerY, {
        align: "center",
      });
      doc.setFont("helvetica", "normal");
      doc.text("COLLEGE OF COMPUTER STUDIES", pageWidth / 2, headerY + 16, {
        align: "center",
      });
      doc.setFontSize(10);
      doc.text(
        "McArthur Highway, Poblacion (Sto. Rosario), Capas, 2315 Tarlac, Philippines",
        pageWidth / 2,
        headerY + 32,
        { align: "center" }
      );
      doc.text(
        "Institutional Contact Nos.: +63938-918-4093    Website: dct.edu.ph",
        pageWidth / 2,
        headerY + 48,
        { align: "center" }
      );
      doc.text(
        "E-mail: domct_2315@yahoo.com.ph / domct_2315@dct.edu.ph",
        pageWidth / 2,
        headerY + 64,
        { align: "center" }
      );
 
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      const titleY = headerY + 96;
      doc.text(title, pageWidth / 2, titleY, { align: "center" });
 
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(
        `As of ${new Date().toLocaleDateString()}`,
        pageWidth / 2,
        titleY + 16,
        {
          align: "center",
        }
      );
 
      doc.setDrawColor(180);
      doc.line(marginX, titleY + 26, pageWidth - marginX, titleY + 26);
 
      return titleY + 38; // table start Y
    };
 
    const drawFooter = () => {
      if (tsImg) {
        const logoW = 72;
        const logoH = (tsImg.height / tsImg.width) * logoW;
        const x = marginX;
        const y = pageHeight - 20 - logoH;
        doc.addImage(tsImg, "PNG", x, y, logoW, logoH);
      }
 
      const str = `Page ${doc.internal.getNumberOfPages()}`;
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(str, pageWidth - marginX, pageHeight - 14, { align: "right" });
    };
 
    const tableYStart = drawHeader();
 
    const contentWidth = pageWidth - marginX * 2;
    const W = {
      no: 0.07 * contentWidth,
      team: 0.23 * contentWidth,
      date: 0.14 * contentWidth,
      time: 0.14 * contentWidth,
      pan: 0.3 * contentWidth,
      ver: 0.12 * contentWidth,
    };
 
    const verdictColor = (v) => {
      const s = String(v || "").toLowerCase();
      if (s === "approved") return [34, 139, 34];
      if (s === "re-present") return [217, 168, 30];
      if (s === "failed") return [106, 15, 20]; // MAROON color for Failed
      return [106, 15, 20]; // Pending/others
    };
 
    autoTable(doc, {
      startY: tableYStart,
      head: [["NO", "Team", "Date", "Time", "Panelists", "Verdict"]],
      body: exportData.map((s, i) => [
        `${i + 1}.`,
        s.teamDisplay || s.teamName || "",
        fmtDate(s.date) || "",
        fmtTime(s.time) || "",
        (s.panelists || []).join(", "),
        s.verdict || "",
      ]),
      styles: {
        fontSize: 9,
        cellPadding: 6,
        overflow: "linebreak",
        valign: "middle",
      },
      headStyles: {
        fillColor: [245, 245, 245],
        textColor: 60,
        lineWidth: 0.4,
        lineColor: [220, 220, 220],
        fontStyle: "bold",
      },
      bodyStyles: { lineWidth: 0.3, lineColor: [235, 235, 235] },
      columnStyles: {
        0: { cellWidth: W.no, halign: "left" },
        1: { cellWidth: W.team },
        2: { cellWidth: W.date },
        3: { cellWidth: W.time },
        4: { cellWidth: W.pan },
        5: { cellWidth: W.ver, halign: "center" },
      },
      margin: { left: marginX, right: marginX, bottom: 64 },
      tableWidth: contentWidth,
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 5) {
          data.cell.styles.textColor = verdictColor(data.cell.text?.[0]);
          data.cell.styles.fontStyle = "bold";
        }
      },
      didDrawPage: () => {
        drawHeader();
        drawFooter();
      },
    });
 
    doc.save(
      `title_defense_schedule_${
        exportFilter === "all" ? "all" : exportFilter.toLowerCase()
      }_${new Date().toISOString().slice(0, 10)}.pdf`
    );
 
    Swal.fire({
      title: "Export Successful!",
      text: `PDF exported with ${exportData.length} ${
        exportFilter === "all" ? "" : exportFilter + " "
      }schedule(s).`,
      icon: "success",
      confirmButtonColor: MAROON,
    });
  };
 
  // EditableRow component for inline editing
  const EditableRow = ({ schedule, onSave, onCancel }) => {
    const [editedData, setEditedData] = useState({
      teamName: schedule.teamName || "",
      date: schedule.date || "",
      time: schedule.time || "",
      panelists: [...(schedule.panelists || [])],
    });
    const [panelistPick, setPanelistPick] = useState("");
 
    const addPanelist = (name) => {
      if (!name) return;
      if (!editedData.panelists.includes(name)) {
        setEditedData((prev) => ({
          ...prev,
          panelists: [...prev.panelists, name],
        }));
      }
      setPanelistPick("");
    };
 
    const removePanelist = (name) => {
      setEditedData((prev) => ({
        ...prev,
        panelists: prev.panelists.filter((n) => n !== name),
      }));
    };
 
    const canEdit = canEditSchedule(schedule);
 
    return (
      <tr className="bg-blue-50">
        <td className="px-4 py-3 text-neutral-600">
          {filtered.findIndex((s) => s.id === schedule.id) + 1}.
        </td>
 
        {/* Team Name (readonly in edit mode) */}
        <td className="px-4 py-3 font-medium text-neutral-800">
          {schedule.teamDisplay || schedule.teamName}
        </td>
 
        {/* Date */}
        <td className="px-4 py-3">
          <div className="relative">
            <input
              type="date"
              value={editedData.date}
              onChange={(e) =>
                setEditedData((prev) => ({ ...prev, date: e.target.value }))
              }
              disabled={!canEdit}
              className={`w-full px-2 py-1 rounded border text-sm ${
                canEdit
                  ? "border-neutral-300"
                  : "border-neutral-200 bg-neutral-100 cursor-not-allowed"
              }`}
              required
            />
          </div>
        </td>
 
        {/* Time Dropdown */}
        <td className="px-4 py-3">
          <div className="relative">
            <select
              value={editedData.time}
              onChange={(e) =>
                setEditedData((prev) => ({ ...prev, time: e.target.value }))
              }
              disabled={!canEdit}
              className={`w-full appearance-none pr-8 pl-2 py-1 rounded border text-sm ${
                canEdit
                  ? "border-neutral-300 bg-white"
                  : "border-neutral-200 bg-neutral-100 cursor-not-allowed"
              }`}
              required
            >
              <option value="">Select Time</option>
              {TIME_OPTIONS.map((time) => (
                <option key={time} value={time}>
                  {fmtTime(time)}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2 top-1.5 text-neutral-500 pointer-events-none"
            />
          </div>
        </td>
 
        {/* Panelists */}
        <td className="px-4 py-3">
          <div className="space-y-2">
            <div className="relative">
              <select
                value={panelistPick}
                onChange={(e) => addPanelist(e.target.value)}
                disabled={!canEdit}
                className={`w-full appearance-none pr-6 pl-2 py-1 rounded border text-sm ${
                  canEdit
                    ? "border-neutral-300 bg-white"
                    : "border-neutral-200 bg-neutral-100 cursor-not-allowed"
                }`}
              >
                <option value="">Select Panelist</option>
                {adviserOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2 top-1.5 text-neutral-500 pointer-events-none"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {editedData.panelists.map((p) => (
                <span
                  key={p}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${
                    canEdit
                      ? "border-neutral-300 bg-white"
                      : "border-neutral-200 bg-neutral-100"
                  }`}
                >
                  <User2 size={12} className="text-neutral-600" />
                  {p}
                  {canEdit && (
                    <button
                      className="ml-0.5 rounded hover:bg-neutral-100 p-0.5"
                      onClick={() => removePanelist(p)}
                      title="Remove"
                    >
                      <X size={12} className="text-neutral-500" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          </div>
        </td>
 
        {/* Verdict */}
        <td className="px-4 py-3">
          <div className="relative inline-flex items-center">
            <select
              value={schedule.verdict || "Pending"}
              onChange={(e) => handleChangeVerdict(schedule.id, e.target.value)}
              disabled={!canEditVerdict(schedule)}
              className={`appearance-none pr-8 pl-3 py-1.5 rounded-md border text-sm ${
                canEditVerdict(schedule) ? "" : "opacity-60 cursor-not-allowed"
              }`}
              style={{ borderColor: MAROON, color: "#111827" }}
            >
              <option>Pending</option>
              <option>Approved</option>
              <option>Re-Present</option>
              <option>Failed</option>
            </select>
            <ChevronDown
              size={16}
              className="absolute right-2 pointer-events-none text-neutral-500"
            />
          </div>
        </td>
 
        {/* Action buttons */}
        <td className="px-2 py-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => onSave(editedData)}
              className="p-1.5 rounded hover:bg-green-100 text-green-600"
              title="Save"
            >
              <Check size={16} />
            </button>
            <button
              onClick={onCancel}
              className="p-1.5 rounded hover:bg-red-100 text-red-600"
              title="Cancel"
            >
              <CloseIcon size={16} />
            </button>
          </div>
        </td>
      </tr>
    );
  };
 
  // Get row background color based on verdict
  const getRowBackgroundColor = (verdict) => {
    if (verdict === "Failed") {
      return "bg-red-600 text-white";
    }
    return "";
  };
 
  return (
    <div className="">
      <Breadcrumbs />
      <div className="mt-2 h-[2px] w-full bg-neutral-200">
        <div
          className="h-[2px]"
          style={{ backgroundColor: MAROON, width: 260 }}
        />
      </div>
 
      {/* actions */}
      <div className="mt-6 space-y-4">
        {/* Row 1: Back + Export (aligned) */}
        <div className="flex items-center gap-3">
          <Btn
            icon={ChevronLeft}
            variant="outline"
            onClick={() =>
              window.history.length
                ? window.history.back()
                : navigate("/instructor/schedule")
            }
          >
            Back to Schedule
          </Btn>
          <Btn icon={Download} variant="outline" onClick={handleExportPDF}>
            Export PDF
          </Btn>
        </div>
 
        {/* Row 2: Search (left) + Filter (right) */}
        <div className="flex items-center justify-between">
          <div className="relative">
            <input
              type="text"
              placeholder="Search team name"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              className="pl-10 pr-3 py-2 w-72 rounded-md border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
            />
            <Search
              size={16}
              className="absolute left-3 top-2.5 text-neutral-400"
            />
          </div>
 
          <div className="flex items-center gap-3">
            {/* Filter Button */}
            <div className="relative">
              <button
                onClick={() => setFilterOpen(!filterOpen)}
                className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                <Filter size={16} />
                Filter
                <ChevronDown size={16} />
              </button>
 
              {filterOpen && (
                <div className="absolute right-0 mt-1 z-20 w-48 rounded-md border bg-white shadow-lg">
                  <div className="py-1">
                    <button
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 ${
                        filterVerdict === "all"
                          ? "bg-neutral-50 font-medium"
                          : ""
                      }`}
                      onClick={() => {
                        setFilterVerdict("all");
                        setFilterOpen(false);
                      }}
                    >
                      All Verdicts
                    </button>
                    <button
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 ${
                        filterVerdict === "Pending"
                          ? "bg-neutral-50 font-medium"
                          : ""
                      }`}
                      onClick={() => {
                        setFilterVerdict("Pending");
                        setFilterOpen(false);
                      }}
                    >
                      Pending
                    </button>
                    <button
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 ${
                        filterVerdict === "Approved"
                          ? "bg-neutral-50 font-medium"
                          : ""
                      }`}
                      onClick={() => {
                        setFilterVerdict("Approved");
                        setFilterOpen(false);
                      }}
                    >
                      Approved
                    </button>
                    <button
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 ${
                        filterVerdict === "Re-Present"
                          ? "bg-neutral-50 font-medium"
                          : ""
                      }`}
                      onClick={() => {
                        setFilterVerdict("Re-Present");
                        setFilterOpen(false);
                      }}
                    >
                      Re-Present
                    </button>
                    <button
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 ${
                        filterVerdict === "Failed"
                          ? "bg-neutral-50 font-medium"
                          : ""
                      }`}
                      onClick={() => {
                        setFilterVerdict("Failed");
                        setFilterOpen(false);
                      }}
                    >
                      Failed
                    </button>
                  </div>
                </div>
              )}
            </div>
 
            {bulkMode && (
              <button
                onClick={exitBulk}
                className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 border border-neutral-300 bg-white"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
 
      {/* Active Filter Badge */}
      {filterVerdict !== "all" && (
        <div className="mt-4 flex items-center gap-2">
          <span className="text-sm text-neutral-600">Active filter:</span>
          <div className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800">
            {filterVerdict}
            <button
              onClick={() => setFilterVerdict("all")}
              className="ml-1 rounded-full hover:bg-blue-200 p-0.5"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
 
      {/* table */}
      <div className="mt-5 rounded-xl border border-neutral-200 bg-white shadow-[0_6px_18px_rgba(0,0,0,0.05)]">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              {bulkMode ? (
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4"
                  />
                </th>
              ) : (
                <th className="text-left px-4 py-3 w-16">NO</th>
              )}
              <th className="text-left px-4 py-3">Team</th>
              <th className="text-left px-4 py-3">
                <div className="inline-flex items-center gap-2">
                  <CalIcon size={16} /> Date
                </div>
              </th>
              <th className="text-left px-4 py-3">
                <div className="inline-flex items-center gap-2">
                  <Clock size={16} /> Time
                </div>
              </th>
              <th className="text-left px-4 py-3">Panelists</th>
              <th className="text-left px-4 py-3">Verdict</th>
              <th className="text-left px-4 py-3 w-16">Action</th>
            </tr>
          </thead>
          <tbody>
            {loadingSchedules ? (
              <tr>
                <td className="px-4 py-6 text-neutral-500" colSpan={7}>
                  Loading schedules…
                </td>
              </tr>
            ) : schedules.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-neutral-500" colSpan={7}>
                  No schedules yet.
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-neutral-500" colSpan={7}>
                  {filterVerdict !== "all"
                    ? `No ${filterVerdict.toLowerCase()} schedules found${
                        queryText ? ` for "${queryText}"` : ""
                      }.`
                    : `No matches found for "${queryText}".`}
                </td>
              </tr>
            ) : (
              filtered.map((s, idx) => {
                if (editingId === s.id) {
                  return (
                    <EditableRow
                      key={s.id}
                      schedule={s}
                      onSave={(updatedData) =>
                        handleSaveEdit(s.id, updatedData)
                      }
                      onCancel={() => setEditingId(null)}
                    />
                  );
                }
 
                const isChecked = selected.has(s.id);
                const rowColor = getRowBackgroundColor(s.verdict);
                const canEditVerdictNow = canEditVerdict(s);
                const canEditScheduleNow = canEditSchedule(s);
 
                return (
                  <tr key={s.id} className={`${rowColor}`}>
                    {/* first column: checkbox or row number */}
                    {bulkMode ? (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${s.teamDisplay || s.teamName}`}
                          checked={isChecked}
                          onChange={() => toggleSelect(s.id)}
                          className="h-4 w-4"
                        />
                      </td>
                    ) : (
                      <td className="px-4 py-3">{idx + 1}.</td>
                    )}
 
                    <td className="px-4 py-3 font-medium">
                      {s.teamDisplay || s.teamName}
                    </td>
 
                    {/* Date */}
                    <td className="px-4 py-3">{fmtDate(s.date) || "—"}</td>
 
                    {/* Time */}
                    <td className="px-4 py-3">{fmtTime(s.time) || "—"}</td>
 
                    {/* Panelists */}
                    <td className="px-4 py-3">
                      {s.panelists.length > 0 ? s.panelists.join(", ") : "—"}
                    </td>
 
                    {/* Verdict */}
                    <td className="px-4 py-3">
                      <div className="relative inline-flex items-center">
                        <select
                          value={s.verdict || "Pending"}
                          onChange={(e) =>
                            handleChangeVerdict(s.id, e.target.value)
                          }
                          onFocus={() => {
                            if (!canEditVerdictNow && s.verdict === "Pending") {
                              showTooltipFor5Sec(s.id);
                            }
                          }}
                          disabled={!canEditVerdictNow || bulkMode}
                          className={`appearance-none pr-8 pl-3 py-1.5 rounded-md border text-sm ${
                            !canEditVerdictNow || bulkMode
                              ? "opacity-60 cursor-not-allowed"
                              : ""
                          }`}
                          style={{
                            borderColor: MAROON,
                            color: s.verdict === "Failed" ? "white" : "#111827",
                            backgroundColor:
                              s.verdict === "Failed" ? "transparent" : "white",
                          }}
                        >
                          <option>Pending</option>
                          <option>Approved</option>
                          <option>Re-Present</option>
                          <option>Failed</option>
                        </select>
                        <ChevronDown
                          size={16}
                          className="absolute right-2 pointer-events-none text-neutral-500"
                        />
                        {showVerdictTooltip === s.id &&
                          !canEditVerdictNow &&
                          s.verdict === "Pending" && (
                            <div className="absolute -top-8 left-0 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-200 shadow-sm z-10">
                              Set verdict after defense date
                            </div>
                          )}
                      </div>
                    </td>
 
                    {/* Row actions - Kebab menu with Update, Schedule Re-Presentation, and Remove */}
                    <td className="px-2 py-3 relative">
                      <button
                        disabled={bulkMode}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-md ${
                          bulkMode
                            ? "opacity-40 cursor-not-allowed"
                            : "hover:bg-neutral-100"
                        }`}
                        onClick={() =>
                          setMenuOpenId(menuOpenId === s.id ? null : s.id)
                        }
                      >
                        <MoreVertical size={18} />
                      </button>
 
                      {!bulkMode && menuOpenId === s.id && (
                        <div className="absolute right-2 mt-1 z-20 w-48 rounded-md border bg-white shadow">
                          <button
                            className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                              canEditScheduleNow
                                ? "hover:bg-neutral-50"
                                : "opacity-50 cursor-not-allowed text-neutral-400"
                            }`}
                            onClick={() => {
                              if (canEditScheduleNow) {
                                setEditingId(s.id);
                                setMenuOpenId(null);
                              }
                            }}
                            disabled={!canEditScheduleNow}
                          >
                            <Check size={14} />
                            Update
                          </button>
                          <button
                            className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                              canEditScheduleNow
                                ? "hover:bg-neutral-50"
                                : "opacity-50 cursor-not-allowed text-neutral-400"
                            }`}
                            onClick={() => {
                              if (canEditScheduleNow) {
                                handleScheduleRePresentation(s);
                                setMenuOpenId(null);
                              }
                            }}
                            disabled={!canEditScheduleNow}
                          >
                            <RotateCcw size={14} />
                            Schedule Re-Presentation
                          </button>
                          <button
                            className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 flex items-center gap-2 text-red-600"
                            onClick={() => {
                              handleDeleteSchedule(s);
                              setMenuOpenId(null);
                            }}
                          >
                            <Trash2 size={14} />
                            Remove
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
 
      {/* View Team Dialog */}
      {viewSchedule && (
        <ViewTeamDialog
          schedule={viewSchedule}
          onClose={() => setViewSchedule(null)}
        />
      )}
    </div>
  );
}
 
/* ------- View Team Dialog ------- */
function ViewTeamDialog({ schedule, onClose }) {
  const [loading, setLoading] = useState(true);
  const [adviser, setAdviser] = useState("-");
  const [manager, setManager] = useState("-");
  const [members, setMembers] = useState([]);
 
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (schedule?.teamId) {
          const ref = doc(db, "teams", schedule.teamId);
          const snap = await getDoc(ref);
          const data = snap.exists() ? snap.data() : null;
          if (alive && data) {
            setAdviser(data?.adviser?.fullName || "-");
            setManager(data?.manager?.fullName || "-");
            setMembers(
              Array.isArray(data?.memberNames) ? data.memberNames : []
            );
          }
        } else {
          setAdviser("-");
          setManager("-");
          setMembers([]);
        }
      } catch (e) {
        console.error("Failed to load team for view:", e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [schedule?.teamId]);
 
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[760px] max-w-[92vw]">
        <div className="rounded-2xl bg-white border border-neutral-200 shadow-2xl focus:outline-none p-0">
          {/* header */}
          <div className="px-6 pt-5 pb-3">
            <div
              className="flex items-center gap-2 text-[16px] font-semibold"
              style={{ color: MAROON }}
            >
              <PlusCircle size={18} />
              View Team
            </div>
            <div className="mt-3 h-[2px] w-full bg-neutral-200">
              <div
                className="h-[2px]"
                style={{ backgroundColor: MAROON, width: 110 }}
              />
            </div>
          </div>
 
          {/* body */}
          <div className="px-6 pb-6">
            <div className="grid grid-cols-2 gap-x-10 gap-y-6">
              {/* Team Name */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Team
                </label>
                <div className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm">
                  {schedule?.teamDisplay || schedule?.teamName || "-"}
                </div>
              </div>
 
              {/* Adviser */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Adviser
                </label>
                <div className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm">
                  {loading ? "Loading…" : adviser}
                </div>
              </div>
 
              {/* Project Manager */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Project Manager
                </label>
                <div className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm">
                  {loading ? "Loading…" : manager}
                </div>
              </div>
 
              {/* Members */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Members
                </label>
                <div className="w-full rounded-md border border-neutral-300 bg-white px-3 py-3 text-sm">
                  {loading ? (
                    "Loading…"
                  ) : members.length === 0 ? (
                    <span className="text-neutral-500">No members listed.</span>
                  ) : (
                    <ul className="list-disc ml-5 space-y-1">
                      {members.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
 
            {/* footer */}
            <div className="mt-8 flex items-center justify-end">
              <button
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}