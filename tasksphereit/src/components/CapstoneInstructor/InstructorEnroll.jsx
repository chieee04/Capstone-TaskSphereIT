//instructor enroll.txt
// src/components/CapstoneInstructor/InstructorEnroll.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import Swal from "sweetalert2";
import {
  Download,
  Upload,
  Search,
  Filter as FilterIcon,
  PlusCircle,
  Undo2,
  Trash2,
  FileText,
  X,
  Pencil,
  MoreVertical,
} from "lucide-react";

import { db } from "../../config/firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";

// (no XLSX import — template download removed)

import { parseExcelFile, validateExcelFile } from "../../assets/scripts/excel";
import {
  createUser,
  saveImportedUsers,
  bulkDeleteUsers,
  bulkResetPasswords,
  getMiddleInitial,
} from "../../assets/scripts/enroll";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ---- logos for PDF (DCT left, CCS right, TaskSphere footer-left) ----
import DCTLOGO from "../../assets/imgs/pdf imgs/DCTLOGO.png";
import CCSLOGO from "../../assets/imgs/pdf imgs/CCSLOGO.png";
import TASKSPHERELOGO from "../../assets/imgs/pdf imgs/TASKSPHERELOGO.png";

import ExcelModal from "../../assets/modals/excelModal.js";
import AddUserModal from "../../assets/modals/addUserModal.jsx";

import EditUserModal from "../../assets/modals/editUserModal.jsx";

import { supabase } from "../../config/supabase.js";

/* ---------- tabs & role mapping ---------- */
const TABS = ["Adviser", "Student"];
const STUDENT_ROLES = ["Project Manager", "Member"];
const displayPlural = (tab) => (tab === "Student" ? "Students" : "Advisers");

// Helper function to get current school year in format "2024-2025"
const getCurrentSchoolYear = () => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1; // January is 0
  
  // If month is June or later (month 6-12), school year is currentYear - nextYear
  // If month is January-May (month 1-5), school year is previousYear - currentYear
  if (currentMonth >= 6) {
    return `${currentYear}-${currentYear + 1}`;
  } else {
    return `${currentYear - 1}-${currentYear}`;
  }
};

export const downloadTemplate = async () => {
  // For a PUBLIC bucket
  const { data } = supabase.storage
    .from("template")
    .getPublicUrl("User-Template.xlsx");
  const url = data.publicUrl;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch template from Supabase");

  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  
  // Updated template name with school year
  const schoolYear = getCurrentSchoolYear();
  a.download = `CCS-Capstone-Template-${schoolYear}.xlsx`;
  
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
};

/* ---------- tiny helpers ---------- */
const isTs = (v) =>
  v && typeof v === "object" && typeof v.toDate === "function";
const toDateValue = (v) => (isTs(v) ? v.toDate() : v ? new Date(v) : null);

const fullNameOf = (u) => {
  const mi = getMiddleInitial(u?.middleName);
  const last = u?.lastName || "";
  const first = u?.firstName || "";
  return `${last}, ${first}${mi ? `, ${mi}` : ""}`;
};

/* =============================== MAIN =============================== */
const InstructorEnroll = () => {
  /* ---------------- Role & dialogs ---------------- */
  const [selectedTab, setSelectedTab] = useState("Adviser");
  const [openAddUserModal, setOpenAddUserModal] = useState(false);
  const [openEditUserModal, setOpenEditUserModal] = useState(false);

  const [form, setForm] = useState({
    id: "",
    email: "",
    lastName: "",
    firstName: "",
    middleName: "",
    idNumber: "",
    role: selectedTab === "Adviser" ? "Adviser" : "Member",
  });

  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  /* ---------------- Users list ---------------- */
  const [users, setUsers] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [qText, setQText] = useState("");

  /* ---------------- Filters ---------------- */
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef(null);

  const [fTos, setFTos] = useState("any");
  const [fMustChange, setFMustChange] = useState("any");
  const [fCreatedFrom, setFCreatedFrom] = useState("");
  const [fCreatedTo, setFCreatedTo] = useState("");
  const [sortBy, setSortBy] = useState("lastName");
  const [sortDir, setSortDir] = useState("asc");

  useEffect(() => {
    const onDocClick = (e) => {
      if (!filterRef.current) return;
      if (!filterRef.current.contains(e.target)) setFilterOpen(false);
    };
    if (filterOpen) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [filterOpen]);

  /* ---------------- Row action menus (3 dots) ---------------- */
  const [openRowMenu, setOpenRowMenu] = useState(null);
  useEffect(() => {
    const closeOnOutside = (e) => {
      if (!e.target.closest('[data-row-menu-root="1"]')) setOpenRowMenu(null);
    };
    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, []);

  /* ---------------- Excel import ---------------- */
  const [importState, setImportState] = useState({
    open: false,
    rows: [],
    parsing: false,
    saving: false,
    err: "",
  });

  const fileRef = useRef(null);
  const triggerExcelModal = () => fileRef.current?.click();

  const handleImportChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!validateExcelFile(file)) {
      ExcelModal.show({
        rows: [],
        parsing: false,
        saving: false,
        err: "Please select a .xlsx or .xlsb Excel file.",
        onFileChange: handleImportChange,
        onSave: saveImportedRows,
        onClose: () => {},
      });
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    try {
      setImportState((p) => ({ ...p, parsing: true, err: "" }));
      const rows = await parseExcelFile(
        file,
        selectedTab === "Student" ? "Student" : "Adviser"
      );
      ExcelModal.show({
        rows,
        parsing: false,
        saving: false,
        err: "",
        onFileChange: handleImportChange,
        onSave: saveImportedRows,
        onClose: () =>
          setImportState({
            open: false,
            rows: [],
            parsing: false,
            saving: false,
            err: "",
          }),
      });
    } catch (error) {
      ExcelModal.show({
        rows: [],
        parsing: false,
        saving: false,
        err: error.message,
        onFileChange: handleImportChange,
        onSave: saveImportedRows,
        onClose: () => {},
      });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const saveImportedRows = async () => {
    const rows = importState.rows.filter((r) => r._select);
    if (rows.length === 0) {
      setImportState((p) => ({ ...p, err: "Nothing selected to save." }));
      return;
    }
    setImportState((p) => ({ ...p, saving: true, err: "" }));
    try {
      await saveImportedUsers(rows, selectedTab);
      setImportState({
        open: false,
        rows: [],
        parsing: false,
        saving: false,
        err: "",
      });
    } catch (error) {
      setImportState((p) => ({ ...p, saving: false, err: error.message }));
    }
  };

  /* ---------------- Create / Update user ---------------- */
  const handleSaveUser = async () => {
  setError("");
  setSaving(true);

  try {
    const trimmedIdNumber = form.idNumber.trim();

    // ✅ Convert to Proper Case before saving
    const toProperCase = (str) =>
      str
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase())
        .trim();

    const properFirst = toProperCase(form.firstName);
    const properLast = toProperCase(form.lastName);
    const properMiddle = toProperCase(form.middleName);

    // ✅ Duplicate check (only for adding new user)
    if (!editingId) {
      const usersRef = collection(db, "users");
      const qy = query(usersRef, where("idNumber", "==", trimmedIdNumber));
      const snap = await getDocs(qy);

      if (!trimmedIdNumber) {
        setError("ID Number is required.");
        setSaving(false);
        return;
      }

      if (!properFirst || !properLast) {
        setError("Please fill in all required fields.");
        setSaving(false);
        return;
      }

      if (!snap.empty) {
        setError("ID Number already exists. Please use a unique ID Number.");
        setSaving(false);
        return;
      }

      // ✅ Generate random Gmail address based on selected tab
      const randomNumber = Math.floor(10000 + Math.random() * 90000);
      const prefix = selectedTab === "Adviser" ? "adviser" : "student";
      const generatedEmail = `${prefix}${randomNumber}@gmail.com`;

      // ✅ Save with Proper Case
      await createUser({
        ...form,
        firstName: properFirst,
        lastName: properLast,
        middleName: properMiddle,
        email: generatedEmail,
      });
    } else {
      // ✅ Update existing user (also apply Proper Case)
      const payload = {
        email: form.email || "",
        lastName: properLast,
        firstName: properFirst,
        middleName: properMiddle,
        idNumber: trimmedIdNumber,
        role: form.role,
      };
      await updateDoc(doc(db, "users", editingId), payload);
    }

    // ✅ Reset after successful save
    setForm({
      id: "",
      email: "",
      lastName: "",
      firstName: "",
      middleName: "",
      idNumber: "",
      role: selectedTab === "Adviser" ? "Adviser" : "Project Manager",
    });
    setEditingId(null);
    setOpenAddUserModal(false);
  } catch (e) {
    console.error(e);
    setError("Error saving user. Please try again.");
  } finally {
    setSaving(false);
  }
};


  const startEdit = (u) => {
    setEditingId(u.id);
    setForm({
      id: u.id,
      uid: u.uid,
      email: u.email || "",
      lastName: u.lastName || "",
      firstName: u.firstName || "",
      middleName: u.middleName || "",
      idNumber: u.idNumber || "",
      role: u.role || "Adviser",
      password: u.mustChangePassword ? "UserUser321" : "********",
    });
    setOpenEditUserModal(true);
  };

  const deleteOne = async (id) => {
  const user = users.find((u) => u.id === id);
  if (!user) return;

  // 🚫 Check if user is Project Manager
  if (user.role === "Project Manager") {
    await Swal.fire({
      icon: "warning",
      title: "Cannot Delete",
      html: `You cannot delete this user because <b>${user.firstName} ${user.lastName}</b> is currently a Project Manager.`,
      confirmButtonColor: "#3B0304",
    });
    return;
  }

  // 🗑 Normal confirmation
  const result = await Swal.fire({
    title: "Remove Account?",
    text: "Are you sure you want to remove it permanently?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#3B0304",
    cancelButtonColor: "#9ca3af",
    confirmButtonText: "Yes, remove it",
    cancelButtonText: "Cancel",
  });

  if (!result.isConfirmed) return;

  await bulkDeleteUsers([id], users);
  setSelectedIds((prev) => prev.filter((x) => x !== id));

  Swal.fire({
    icon: "success",
    title: "Removed!",
    text: "The account has been removed successfully.",
    timer: 2000,
    showConfirmButton: false,
  });
};



  /* ---------------- Firestore subscription ---------------- */
  useEffect(() => {
    setLoadingList(true);
    const usersRef = collection(db, "users");
    let qy;
    if (selectedTab === "Student") {
      qy = query(usersRef, where("role", "in", STUDENT_ROLES));
    } else {
      qy = query(usersRef, where("role", "==", "Adviser"));
    }
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setUsers(data);
        setLoadingList(false);
      },
      (err) => {
        console.error(err);
        setLoadingList(false);
      }
    );
    return () => unsub();
  }, [selectedTab]);

  /* ---------------- Search + Filter + Sort (client-side) ---------------- */
  const filteredUsers = useMemo(() => {
    let arr = [...users];

    const needle = qText.trim().toLowerCase();
    if (needle) {
      arr = arr.filter((u) => {
        const mid = u.middleName || "";
        return (
          (u.idNumber || "").toLowerCase().includes(needle) ||
          (u.firstName || "").toLowerCase().includes(needle) ||
          (u.lastName || "").toLowerCase().includes(needle) ||
          mid.toLowerCase().includes(needle) ||
          (u.email || "").toLowerCase().includes(needle)
        );
      });
    }

    if (fTos !== "any") {
      const want = fTos === "accepted";
      arr = arr.filter((u) => !!u.isTosAccepted === want);
    }

    if (fMustChange !== "any") {
      const want = fMustChange === "true";
      arr = arr.filter((u) => !!u.mustChangePassword === want);
    }

    const from = fCreatedFrom ? new Date(`${fCreatedFrom}T00:00:00`) : null;
    const to = fCreatedTo ? new Date(`${fCreatedTo}T23:59:59`) : null;
    if (from) {
      arr = arr.filter((u) => {
        const d = toDateValue(u.createdAt);
        return d ? d >= from : false;
      });
    }
    if (to) {
      arr = arr.filter((u) => {
        const d = toDateValue(u.createdAt);
        return d ? d <= to : false;
      });
    }

    const field = sortBy;
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      const va =
        field === "createdAt"
          ? toDateValue(a.createdAt)?.getTime?.() ?? 0
          : (a[field] || "").toString().toLowerCase();
      const vb =
        field === "createdAt"
          ? toDateValue(b.createdAt)?.getTime?.() ?? 0
          : (b[field] || "").toString().toLowerCase();

      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });

    return arr;
  }, [
    users,
    qText,
    fTos,
    fMustChange,
    fCreatedFrom,
    fCreatedTo,
    sortBy,
    sortDir,
  ]);

  /* ---------------- Bulk actions ---------------- */
  const [selectedIds, setSelectedIds] = useState([]);
  const toggleOne = (id) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  const toggleAll = () =>
    setSelectedIds((prev) =>
      prev.length === filteredUsers.length ? [] : filteredUsers.map((u) => u.id)
    );

  const handleBulkDelete = async () => {
  if (selectedIds.length === 0) return;

  // 🚫 Check for Project Managers
  const selectedUsers = users.filter((u) => selectedIds.includes(u.id));
  const projectManagers = selectedUsers.filter((u) => u.role === "Project Manager");

  if (projectManagers.length > 0) {
    const listHtml = projectManagers
      .map((u) => `• ${u.firstName} ${u.lastName}`)
      .join("<br>");
    await Swal.fire({
      icon: "warning",
      title: "Cannot Delete",
      html: `You cannot delete these users because they are currently Project Managers:<br><br>${listHtml}`,
      confirmButtonColor: "#3B0304",
    });
    return;
  }

  // 🗑 Normal confirmation
  const result = await Swal.fire({
    title: "Remove Accounts?",
    text:
      selectedIds.length === 1
        ? "Are you sure you want to remove this account permanently?"
        : `Are you sure you want to remove these ${selectedIds.length} accounts permanently?`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#3B0304",
    cancelButtonColor: "#9ca3af",
    confirmButtonText: "Yes, remove them",
    cancelButtonText: "Cancel",
  });

  if (!result.isConfirmed) return;

  await bulkDeleteUsers(selectedIds, users);
  setSelectedIds([]);

  Swal.fire({
    icon: "success",
    title: "Removed!",
    text: "Selected accounts have been removed successfully.",
    timer: 2000,
    showConfirmButton: false,
  });
};



  const handleBulkResetDefault = async () => {
    if (selectedIds.length === 0) return;
    if (
      !confirm(
        `Reset password to default for ${selectedIds.length} account(s)?`
      )
    )
      return;
    await bulkResetPasswords(selectedIds);
    alert("Selected users will get default password on next successful login.");
    setSelectedIds([]);
  };

  const resetFilters = () => {
    setFTos("any");
    setFMustChange("any");
    setFCreatedFrom("");
    setFCreatedTo("");
    setSortBy("lastName");
    setSortDir("asc");
  };

  /* ---------------- Export Credentials Modal ---------------- */
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 p-4 md:p-6">
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xlsb,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.binary.macroEnabled.12"
        className="hidden"
        onChange={handleImportChange}
      />

      <main className="min-h-full flex flex-col">
        {/* ===== Updated Header + underline (Title Defense style) ===== */}
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-neutral-800" />
            <h2 className="text-base font-semibold text-neutral-900">
              {displayPlural(selectedTab)}
            </h2>
          </div>
          <div className="mt-3 h-[2px] w-full bg-[#3B0304]" />
        </div>

        {/* ===== Updated Action buttons (Title Defense style) ===== */}
        <div className="flex items-center justify-between gap-3 mb-4 mt-4">
          <div className="flex items-center gap-2">
            {/* Download Template Button */}
            <button
              onClick={downloadTemplate}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-white shadow text-sm"
              style={{ backgroundColor: "#3B0304" }}
            >
              <Download className="w-4 h-4" />
              Download Template
            </button>

            {/* Import File Button */}
            <button
              onClick={triggerExcelModal}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-white shadow text-sm"
              style={{ backgroundColor: "#3B0304" }}
            >
              <Upload className="w-4 h-4" />
              Import File
            </button>

            {/* Export Credentials Button */}
            <button
              onClick={() => setExportOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-white shadow text-sm"
              style={{ backgroundColor: "#3B0304" }}
            >
              <Download className="w-4 h-4" />
              Export Credentials
            </button>
          </div>

          {/* Bulk Actions (when items are selected) */}
          {selectedIds.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={handleBulkResetDefault}
                className="flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
              >
                <Undo2 className="w-4 h-4" />
                Reset Selected
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
                Delete Selected
              </button>
            </div>
          )}
        </div>

        {/* ===== Tabs + search/filters row ===== */}
        <div className="mt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setSelectedTab(tab);
                  setForm((f) => ({
                    ...f,
                    role:
                      tab === "Adviser"
                        ? "Adviser"
                        : STUDENT_ROLES.includes(f.role)
                        ? f.role
                        : "Project Manager",
                  }));
                  setEditingId(null);
                }}
                className={`cursor-pointer px-4 py-2 rounded-full text-sm font-medium ${
                  selectedTab === tab
                    ? "bg-[#3B0304] text-white"
                    : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Search + filter */}
          <div className="relative flex items-center w-full md:max-w-xl gap-2">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="w-4 h-4 text-neutral-500" />
              </span>
              <input
                type="text"
                value={qText}
                onChange={(e) => setQText(e.target.value)}
                placeholder="Search by ID, name, or email"
                className="w-full rounded-full border border-neutral-300 bg-white py-2 pl-9 pr-3 text-sm text-neutral-700 outline-none focus:ring-2 focus:ring-[#3B0304]/30"
              />
            </div>

            <button
              onClick={() => setFilterOpen((s) => !s)}
              className="p-2 rounded-lg border border-neutral-300 hover:bg-neutral-100 cursor-pointer"
              aria-haspopup="dialog"
              aria-expanded={filterOpen}
              aria-controls="enroll-filter-popover"
            >
              <FilterIcon className="w-5 h-5 text-neutral-600" />
            </button>

            {filterOpen && (
              <div
                id="enroll-filter-popover"
                ref={filterRef}
                className="absolute right-0 top-11 z-20 w-[min(560px,92vw)] rounded-2xl border border-neutral-200 bg-white shadow-xl p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold">Filters</div>
                  <button
                    className="p-1.5 rounded-md hover:bg-neutral-100 cursor-pointer "
                    onClick={() => setFilterOpen(false)}
                    aria-label="Close"
                  >
                    <X className="w-4 h-4 " />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">
                      ToS Status
                    </label>
                    <select
                      value={fTos}
                      onChange={(e) => setFTos(e.target.value)}
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                    >
                      <option value="any">Any</option>
                      <option value="accepted">Accepted</option>
                      <option value="not">Not accepted</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">
                      Must Change Password
                    </label>
                    <select
                      value={fMustChange}
                      onChange={(e) => setFMustChange(e.target.value)}
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                    >
                      <option value="any">Any</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">
                      Created From
                    </label>
                    <input
                      type="date"
                      value={fCreatedFrom}
                      onChange={(e) => setFCreatedFrom(e.target.value)}
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">
                      Created To
                    </label>
                    <input
                      type="date"
                      value={fCreatedTo}
                      onChange={(e) => setFCreatedTo(e.target.value)}
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">
                      Sort By
                    </label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                    >
                      <option value="lastName">Last Name</option>
                      <option value="firstName">First Name</option>
                      <option value="idNumber">ID Number</option>
                      <option value="createdAt">Created Date</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">
                      Direction
                    </label>
                    <select
                      value={sortDir}
                      onChange={(e) => setSortDir(e.target.value)}
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                    >
                      <option value="asc">Ascending</option>
                      <option value="desc">Descending</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <button
                    className="text-sm text-neutral-700 underline underline-offset-2"
                    onClick={resetFilters}
                  >
                    Reset all
                  </button>
                  <div className="flex gap-2">
                    <button
                      className="px-4 py-2 rounded-lg border border-neutral-300 text-sm hover:bg-neutral-100"
                      onClick={() => setFilterOpen(false)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ===== User list ===== */}
        <div className="mt-6 flex flex-col md:flex-row gap-6">
          <div className="flex-1">
            <div className="border border-neutral-200 rounded-2xl shadow-lg overflow-visible bg-white">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-neutral-700">
                      <input
                        type="checkbox"
                        checked={
                          selectedIds.length === filteredUsers.length &&
                          filteredUsers.length > 0
                        }
                        onChange={toggleAll}
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-neutral-700">
                      ID Number
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-neutral-700">
                      Last Name
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-neutral-700">
                      First Name
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-neutral-700">
                      Middle Initial
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-neutral-700">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-neutral-200">
                  {loadingList ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-6 text-center text-sm text-neutral-500"
                      >
                        Loading...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-6 text-center text-sm text-neutral-500"
                      >
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(u.id)}
                            onChange={() => toggleOne(u.id)}
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-neutral-700">
                          {u.idNumber || ""}
                        </td>
                        <td className="px-4 py-3 text-sm text-neutral-700">
                          {u.lastName || ""}
                        </td>
                        <td className="px-4 py-3 text-sm text-neutral-700">
                          {u.firstName || ""}
                        </td>
                        <td className="px-4 py-3 text-sm text-neutral-700">
                          {getMiddleInitial(u.middleName)}
                        </td>
                        <td className="px-4 py-2">
                          <div
                            className="relative inline-block"
                            data-row-menu-root="1"
                          >
                            <button
                              onClick={() =>
                                setOpenRowMenu((cur) =>
                                  cur === u.id ? null : u.id
                                )
                              }
                              className="p-1.5 rounded-md border border-neutral-300 hover:bg-neutral-100"
                              title="More"
                              aria-haspopup="menu"
                              aria-expanded={openRowMenu === u.id}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {openRowMenu === u.id && (
                              <div
                                role="menu"
                                className="absolute right-0 z-20 mt-1 w-40 rounded-xl border border-neutral-200 bg-white shadow-lg p-1"
                              >
                                <button
                                  role="menuitem"
                                  onClick={() => {
                                    setOpenRowMenu(null);
                                    startEdit(u);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-neutral-100"
                                >
                                  <Pencil className="w-4 h-4" />
                                  Edit
                                </button>
                                <button
                                  role="menuitem"
                                  onClick={() => {
                                    setOpenRowMenu(null);
                                    deleteOne(u.id);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-red-50 text-red-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add User Button */}
          <div className="w-full md:w-64">
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                // Reset all input fields to blank when opening modal
                setForm({
                  id: "",
                  email: "",
                  idNumber: "",
                  firstName: "",
                  middleName: "",
                  lastName: "",
                  role: selectedTab === "Adviser" ? "Adviser" : "Member", // default to Member
                });
                setError("");
                setOpenAddUserModal(true);
              }}
              className="w-full h-full focus:outline-none"
              aria-haspopup="dialog"
              aria-expanded={openAddUserModal}
            >
              <div className="flex flex-col items-center justify-center border border-neutral-200 rounded-2xl shadow-lg p-6 h-full hover:bg-neutral-50">
                <div className="flex items-center justify-center h-16 w-16 rounded-full border border-neutral-300">
                  <PlusCircle className="w-8 h-8 text-[#3B0304]" />
                </div>
                <p className="mt-4 text-base font-semibold text-[#3B0304] text-center uppercase tracking-wide">
                  Add {selectedTab === "Student" ? "Student" : "Adviser"}
                </p>
              </div>
            </button>
          </div>
        </div>
      </main>

      {/* Add User Modal */}
      <AddUserModal
        open={openAddUserModal}
        form={form}
        onChange={(key) => (e) =>
          setForm((f) => ({ ...f, [key]: e.target.value }))}
        handleSaveUser={handleSaveUser}
        saving={saving}
        closeModal={() => {
          setOpenAddUserModal(false);
          setEditingId(null);
          setError("");
        }}
        error={error}
        roleOptions={selectedTab === "Student" ? STUDENT_ROLES : ["Adviser"]}
        lockRole={
          (selectedTab === "Student" ? STUDENT_ROLES : ["Adviser"]).length === 1
        }
        isEditing={!!editingId}
      />

      {/* Edit User Modal */}
      <EditUserModal
        open={openEditUserModal}
        form={form}
        onChange={(key) => (e) =>
          setForm((f) => ({ ...f, [key]: e.target.value }))}
        handleSaveUser={handleSaveUser}
        saving={saving}
        closeModal={() => {
          setOpenEditUserModal(false);
          setEditingId(null);
          setError("");
        }}
        error={error}
        roleOptions={selectedTab === "Student" ? STUDENT_ROLES : ["Adviser"]}
        lockRole={
          (selectedTab === "Student" ? STUDENT_ROLES : ["Adviser"]).length === 1
        }
      />

      {/* Export Credentials Modal */}
      {exportOpen && (
        <ExportCredentialsModal onClose={() => setExportOpen(false)} />
      )}
    </div>
  );
};

export default InstructorEnroll;

/* ===================== Export Modal (inline) ===================== */
function ExportCredentialsModal({ onClose }) {
  const [audience, setAudience] = useState("Student");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Modified to check mustChangePassword flag
  const getPasswordForUser = (userDoc) => {
    // If mustChangePassword is true, show the default password
    if (userDoc.mustChangePassword === true) {
      return "UserUser321";
    }
    // Otherwise show asterisks
    return "********";
  };

  const fetchUsersForExport = async () => {
    const usersRef = collection(db, "users");
    let base;
    if (audience === "Student") {
      base = query(
        usersRef,
        where("role", "in", ["Project Manager", "Member"])
      );
    } else {
      base = query(usersRef, where("role", "==", "Adviser"));
    }

    const snap = await getDocs(base);
    let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const fromD = from ? new Date(`${from}T00:00:00`) : null;
    const toD = to ? new Date(`${to}T23:59:59`) : null;

    rows = rows.filter((u) => {
      if (!fromD && !toD) return true;
      const dv = toDateValue(u.createdAt);
      if (!dv) return false;
      if (fromD && dv < fromD) return false;
      if (toD && dv > toD) return false;
      return true;
    });

    rows.sort((a, b) => {
      const aL = (a.lastName || "").toLowerCase();
      const bL = (b.lastName || "").toLowerCase();
      if (aL !== bL) return aL < bL ? -1 : 1;
      const aF = (a.firstName || "").toLowerCase();
      const bF = (b.firstName || "").toLowerCase();
      return aF < bF ? -1 : aF > bF ? 1 : 0;
    });

    // Add password to each user based on mustChangePassword flag
    const withPw = rows.map((u) => ({
      ...u,
      _password: getPasswordForUser(u),
    }));

    return withPw;
  };

  const loadImage = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  const makePdf = async (rows) => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 40;

    let dctImg, ccsImg, tsImg;
    try {
      [dctImg, ccsImg, tsImg] = await Promise.all([
        loadImage(DCTLOGO),
        loadImage(CCSLOGO),
        loadImage(TASKSPHERELOGO),
      ]);
    } catch {
      // continue without images
    }

    const headerHeight = 226; // Fixed header height

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
      doc.text(
        audience === "Student"
          ? "Capstone Student Credentials"
          : "Capstone Adviser Credentials",
        pageWidth / 2,
        titleY,
        { align: "center" }
      );

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const dateLineParts = [];
      if (from) dateLineParts.push(`From: ${from}`);
      if (to) dateLineParts.push(`To: ${to}`);
      const dateLine =
        dateLineParts.length > 0
          ? dateLineParts.join("   ")
          : `As of ${new Date().toLocaleDateString()}`;
      doc.text(dateLine, pageWidth / 2, titleY + 16, { align: "center" });

      doc.setDrawColor(180);
      doc.line(marginX, titleY + 26, pageWidth - marginX, titleY + 26);
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

    // Draw header on first page
    drawHeader();

    autoTable(doc, {
      startY: headerHeight,
      head: [["NO", "Full Name", "UserID", "Password"]],
      body: rows.map((u, i) => [
        `${i + 1}.`,
        fullNameOf(u),
        u.idNumber || "",
        u._password || "—",
      ]),
      styles: { fontSize: 10, cellPadding: 6 },
      headStyles: {
        fillColor: [245, 245, 245],
        textColor: 60,
        lineWidth: 0.4,
        lineColor: [220, 220, 220],
        fontStyle: "bold",
      },
      bodyStyles: { lineWidth: 0.3, lineColor: [235, 235, 235] },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 260 },
        2: { cellWidth: 120 },
        3: { cellWidth: 140 },
      },
      margin: { top: headerHeight, left: 40, right: 40, bottom: 64 },
      didDrawPage: (data) => {
        // Only draw header on first page and when starting a new page
        if (data.pageNumber === 1 || data.pageNumber > 1) {
          drawHeader();
        }
        drawFooter();
      },
    });

    const fnameSafe =
      (audience === "Student"
        ? "capstone_student_credentials"
        : "capstone_adviser_credentials") +
      "_" +
      new Date().toISOString().slice(0, 10);
    doc.save(`${fnameSafe}.pdf`);
  };

  const onGenerate = async () => {
    try {
      setBusy(true);
      setErr("");
      const rows = await fetchUsersForExport();
      await makePdf(rows);
      onClose();
    } catch (e) {
      console.error(e);
      setErr("Export failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] max-w-[92vw]">
        <div className="rounded-2xl bg-white border border-neutral-200 shadow-2xl p-0">
          {/* Header */}
          <div className="px-6 pt-5 pb-3">
            <div className="flex items-center gap-2 text-[16px] font-semibold text-[#3B0304]">
              <Download size={18} />
              Export Credentials
            </div>
            <div className="mt-3 h-[2px] w-full bg-neutral-200">
              <div
                className="h-[2px]"
                style={{ backgroundColor: "#3B0304", width: 190 }}
              />
            </div>
          </div>

          {/* Body */}
          <div className="px-6 pb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  What do you want to export?
                </label>
                <div className="flex gap-4">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="audience"
                      value="Student"
                      checked={audience === "Student"}
                      onChange={() => setAudience("Student")}
                    />
                    Students
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="audience"
                      value="Adviser"
                      checked={audience === "Adviser"}
                      onChange={() => setAudience("Adviser")}
                    />
                    Advisers
                  </label>
                </div>
              </div>
            </div>

            {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

            <div className="mt-8 flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                disabled={busy}
              >
                Cancel
              </button>
              <button
                onClick={onGenerate}
                disabled={busy}
                className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold text-white ${
                  busy ? "opacity-60 cursor-not-allowed" : ""
                }`}
                style={{ backgroundColor: "#3B0304" }}
              >
                {busy ? "Generating…" : "Generate PDF"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}