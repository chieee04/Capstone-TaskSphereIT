import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Plus,
  MoreVertical,
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo2,
  Redo2,
  IndentIncrease,
  IndentDecrease,
  X,
  Strikethrough,
  Link as LinkIcon,
  Image as ImageIcon,
  Download,
  FileText,
  ClipboardList,
} from "lucide-react";
import Swal from "sweetalert2";

/* ===== Firebase ===== */
import { auth, db } from "../config/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  serverTimestamp,
} from "firebase/firestore";

/* ===== Supabase ===== */
import { supabase } from "../config/supabase"; // Make sure you have this config file

const MAROON = "#3B0304";

/* ---------------- Helpers ---------------- */
const plainPreview = (html, max = 120) => {
  const tmp = document.createElement("div");
  tmp.innerHTML = html || "";
  const text = tmp.textContent || tmp.innerText || "";
  return text.length > max ? `${text.slice(0, max)}…` : text;
};

const formatDate = (timestamp) => {
  if (!timestamp) return "No date";
  
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return "Invalid date";
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    });
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Invalid date";
  }
};

const roleRoutingMap = {
  // route segment -> { roleName, roleDocId, subColName }
  adviser: { role: "Adviser", doc: "adviser", sub: "adviserNotes" },
  projectmanager: {
    role: "Project Manager",
    doc: "projectManager",
    sub: "projectManagerNotes",
  },
  "project-manager": {
    role: "Project Manager",
    doc: "projectManager",
    sub: "projectManagerNotes",
  },
  member: { role: "Member", doc: "member", sub: "memberNotes" },
  instructor: { role: "Instructor", doc: "instructor", sub: "instructorNotes" },
};

/* ---------------- Image Upload Functions ---------------- */
const uploadImageToSupabase = async (file, userId) => {
  try {
    // Generate unique filename
    const fileExt = file.name.split(".").pop();
    const fileName = `${userId}/${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 15)}.${fileExt}`;

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from("user-notes")
      .upload(fileName, file);

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("user-notes").getPublicUrl(fileName);

    return {
      url: publicUrl,
      fileName: fileName,
      originalName: file.name,
    };
  } catch (error) {
    console.error("Error uploading to Supabase:", error);
    throw error;
  }
};

const deleteImageFromSupabase = async (fileName) => {
  try {
    const { error } = await supabase.storage
      .from("user-notes")
      .remove([fileName]);

    if (error) {
      console.error("Error deleting from Supabase:", error);
      throw error;
    }
    return true;
  } catch (error) {
    console.error("Error deleting image:", error);
    throw error;
  }
};

// Function to download image
const downloadImage = async (imageUrl, imageName) => {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = imageName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the blob URL
    window.URL.revokeObjectURL(blobUrl);

    Swal.fire({
      icon: "success",
      title: "Download Started",
      text: `"${imageName}" is being downloaded`,
      confirmButtonColor: MAROON,
      timer: 2000,
    });
  } catch (error) {
    console.error("Download error:", error);
    Swal.fire({
      icon: "error",
      title: "Download Failed",
      text: "Failed to download image. Please try again.",
      confirmButtonColor: MAROON,
    });
  }
};

/* ---------------- Confirmation Dialog ---------------- */
function ConfirmationDialog({
  open,
  onClose,
  onConfirm,
  title = "Confirmation",
  message = "Are you sure you want to proceed?",
  confirmText = "Yes",
  cancelText = "No",
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 overscroll-contain">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">
              {title}
            </h3>
            <p className="text-neutral-600">{message}</p>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white shadow hover:bg-[#4A0405]"
              style={{ backgroundColor: MAROON }}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Modals ---------------- */
function Modal({ title, children, onClose }) {
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleClose = () => {
    if (hasChanges) {
      setShowExitConfirm(true);
    } else {
      onClose();
    }
  };

  const handleConfirmExit = () => {
    setShowExitConfirm(false);
    onClose();
  };

  // Function to set changes from child components
  const setChanges = (hasChanges) => {
    setHasChanges(hasChanges);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div
          className="absolute inset-0 bg-black/30"
          onClick={handleClose}
          aria-hidden
        />
        <div className="relative max-h-[90vh] w-[min(900px,92vw)] overflow-auto rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold">{title}
            </h3>
            <button
              className="p-2 rounded-md hover:bg-neutral-100 cursor-pointer"
              onClick={handleClose}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {React.cloneElement(children, { setChanges })}
        </div>
      </div>

      {/* Exit Confirmation */}
      <ConfirmationDialog
        open={showExitConfirm}
        onClose={() => setShowExitConfirm(false)}
        onConfirm={handleConfirmExit}
        title="Discard Changes?"
        message="Are you sure you want to exit? Any unsaved changes will be lost."
        confirmText="Yes, Exit"
        cancelText="No, Stay"
      />
    </>
  );
}

/* ---------------- Toolbar ---------------- */
const Toolbar = ({ onCmd, onInsertLink, onAttachImage, active }) => {
  const baseBtn =
    "inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border border-neutral-300 hover:bg-neutral-100 cursor-pointer select-none";
  const activeBtn = "bg-[#3B0304] text-white border-[#3B0304]";
  const group = "flex items-center gap-2";

  const h = (cmd) => (e) => {
    e.preventDefault();
    onCmd(cmd);
  };

  return (
    <div className="flex flex-wrap items-center gap-3 p-2 border-b border-neutral-200 bg-neutral-50">
      <div className={group}>
        <button
          className={`${baseBtn} ${active.bold ? activeBtn : ""}`}
          type="button"
          onMouseDown={h("bold")}
          title="Bold"
          aria-pressed={active.bold}
        >
          <BoldIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Bold</span>
        </button>
        <button
          className={`${baseBtn} ${active.italic ? activeBtn : ""}`}
          type="button"
          onMouseDown={h("italic")}
          title="Italic"
          aria-pressed={active.italic}
        >
          <ItalicIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Italic</span>
        </button>
        <button
          className={`${baseBtn} ${active.underline ? activeBtn : ""}`}
          type="button"
          onMouseDown={h("underline")}
          title="Underline"
          aria-pressed={active.underline}
        >
          <UnderlineIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Underline</span>
        </button>
        <button
          className={`${baseBtn} ${active.strike ? activeBtn : ""}`}
          type="button"
          onMouseDown={h("strikeThrough")}
          title="Strikethrough"
          aria-pressed={active.strike}
        >
          <Strikethrough className="w-4 h-4" />
          <span className="hidden sm:inline">Strike</span>
        </button>
      </div>

      <div className={group}>
        <button
          className={`${baseBtn} ${active.ul ? activeBtn : ""}`}
          type="button"
          title="Bulleted list"
          onMouseDown={h("insertUnorderedList")}
          aria-pressed={active.ul}
        >
          <List className="w-4 h-4" />
          <span className="hidden sm:inline">Bullets</span>
        </button>
        <button
          className={`${baseBtn} ${active.ol ? activeBtn : ""}`}
          type="button"
          title="Numbered list"
          onMouseDown={h("insertOrderedList")}
          aria-pressed={active.ol}
        >
          <ListOrdered className="w-4 h-4" />
          <span className="hidden sm:inline">Numbered</span>
        </button>
        <button
          className={baseBtn}
          type="button"
          title="Outdent"
          onMouseDown={h("outdent")}
        >
          <IndentDecrease className="w-4 h-4" />
        </button>
        <button
          className={baseBtn}
          type="button"
          title="Indent"
          onMouseDown={h("indent")}
        >
          <IndentIncrease className="w-4 h-4" />
        </button>
      </div>

      <div className={group}>
        <button
          className={`${baseBtn} ${active.align === "left" ? activeBtn : ""}`}
          type="button"
          onMouseDown={h("justifyLeft")}
          title="Align left"
          aria-pressed={active.align === "left"}
        >
          <AlignLeft className="w-4 h-4" />
        </button>
        <button
          className={`${baseBtn} ${active.align === "center" ? activeBtn : ""}`}
          type="button"
          onMouseDown={h("justifyCenter")}
          title="Align center"
          aria-pressed={active.align === "center"}
        >
          <AlignCenter className="w-4 h-4" />
        </button>
        <button
          className={`${baseBtn} ${active.align === "right" ? activeBtn : ""}`}
          type="button"
          onMouseDown={h("justifyRight")}
          title="Align right"
          aria-pressed={active.align === "right"}
        >
          <AlignRight className="w-4 h-4" />
        </button>
      </div>

      <div className={group}>
        <button
          className={baseBtn}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onInsertLink();
          }}
          title="Insert link"
        >
          <LinkIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Link</span>
        </button>
        <button
          className={baseBtn}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onAttachImage?.();
          }}
          title="Attach image"
        >
          <ImageIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Attach</span>
        </button>
      </div>

      <div className={group}>
        <button className={baseBtn} type="button" onMouseDown={h("undo")}>
          <Undo2 className="w-4 h-4" />
          <span className="hidden sm:inline">Undo</span>
        </button>
        <button className={baseBtn} type="button" onMouseDown={h("redo")}>
          <Redo2 className="w-4 h-4" />
          <span className="hidden sm:inline">Redo</span>
        </button>
      </div>
    </div>
  );
};

/* ---------------- Card ---------------- */
function NoteCard({ note, index, onEdit, onAskDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="relative w-full">
      <div
        className="relative h-80 bg-white border border-neutral-200 rounded-2xl shadow-[0_6px_12px_rgba(0,0,0,0.12)] overflow-hidden transition-all duration-300 hover:translate-y-[-8px] hover:shadow-[0_12px_24px_rgba(0,0,0,0.18)] cursor-pointer group"
        onClick={() => onEdit(note)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onEdit(note)}
      >
        {/* Left colored accent */}
        <div className="absolute left-0 top-0 h-full w-2 sm:w-3 md:w-8 bg-[#3B0304] group-hover:bg-[#2A0203] transition-colors duration-300" />
        
        {/* Content area */}
        <div className="pl-4 sm:pl-6 md:pl-12 pr-3 sm:pr-4 pt-6 sm:pt-8 pb-4 sm:pb-6 flex h-full flex-col items-center text-center">
          {/* Large note icon */}
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-full bg-[#3B0304]/10 group-hover:bg-[#3B0304]/15 transition-colors duration-300">
            <FileText className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-[#3B0304]" />
          </div>

          {/* Note title */}
          <h3 className="font-semibold text-base sm:text-lg mb-2 sm:mb-3 line-clamp-2 text-[#3B0304] group-hover:text-[#2A0203] transition-colors duration-300 px-2">
            {note.title || `Note ${index + 1}`}
          </h3>

          {/* Preview text */}
          <p className="text-xs sm:text-sm text-neutral-600 flex-1 overflow-hidden line-clamp-4 px-2">
            {plainPreview(note.content, 120)}
          </p>

          {/* Date information */}
          <div className="mt-3 pt-3 border-t border-neutral-200 w-full">
            <div className="text-xs text-neutral-500 space-y-1">
              <div className="flex justify-between">
                <span>Created:</span>
                <span className="font-medium">{formatDate(note.createdAt)}</span>
              </div>
              {note.updatedAt && (
                <div className="flex justify-between">
                  <span>Updated:</span>
                  <span className="font-medium">{formatDate(note.updatedAt)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Menu button */}
        <button
          className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10 p-1.5 rounded-md hover:bg-neutral-100 cursor-pointer transition-colors duration-200"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((o) => !o);
          }}
          aria-label="Open menu"
        >
          <MoreVertical className="w-4 h-4 text-neutral-600" />
        </button>

        {/* Dropdown menu */}
        {menuOpen && (
          <div
            className="absolute right-2 sm:right-3 top-10 sm:top-12 z-20 w-28 sm:w-32 rounded-lg border border-neutral-200 bg-white shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="block w-full px-3 sm:px-4 py-2 text-left text-xs sm:text-sm hover:bg-neutral-50 cursor-pointer transition-colors duration-200"
              onClick={() => {
                setMenuOpen(false);
                onEdit(note);
              }}
            >
              Edit
            </button>
            <button
              className="block w-full px-3 sm:px-4 py-2 text-left text-xs sm:text-sm hover:bg-neutral-50 cursor-pointer transition-colors duration-200"
              onClick={() => {
                setMenuOpen(false);
                onAskDelete(note);
              }}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Form (contenteditable) ---------------- */
function NoteForm({ existing, onSave, onCancel, setChanges }) {
  const [title, setTitle] = useState(existing?.title || "");
  const [content, setContent] = useState(existing?.content || "");
  const [focused, setFocused] = useState(false);
  const [attachedImages, setAttachedImages] = useState(
    existing?.attachedImages || []
  );
  const [newImages, setNewImages] = useState([]); // Store new images as File objects
  const [imagesToDelete, setImagesToDelete] = useState([]); // Track images to delete from Supabase
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState({
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    ul: false,
    ol: false,
    align: "left",
  });
  const editorRef = useRef(null);
  const selectionRef = useRef(null);
  const fileInputRef = useRef(null);

  // Track changes for exit confirmation
  useEffect(() => {
    const hasUnsavedChanges = 
      title !== (existing?.title || "") ||
      content !== (existing?.content || "") ||
      newImages.length > 0 ||
      imagesToDelete.length > 0 ||
      JSON.stringify(attachedImages) !== JSON.stringify(existing?.attachedImages || []);
    
    setChanges?.(hasUnsavedChanges);
  }, [title, content, newImages, imagesToDelete, attachedImages, existing, setChanges]);

  const normalizeEditorHTML = () => {
    const el = editorRef.current;
    if (!el) return;
    el.querySelectorAll("ul").forEach((ul) => {
      ul.classList.add("list-disc", "pl-6", "my-1");
      ul.classList.remove("list-decimal");
    });
    el.querySelectorAll("ol").forEach((ol) => {
      ol.classList.add("list-decimal", "pl-6", "my-1");
      ol.classList.remove("list-disc");
    });
    el.querySelectorAll("li").forEach((li) => {
      li.classList.add("ml-1");
    });
  };

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = existing?.content || "";
      normalizeEditorHTML();
      setContent(editorRef.current.innerHTML);
      refreshActiveStates();
    }
  }, [existing]);

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      selectionRef.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    if (!selectionRef.current || !editorRef.current) return;
    const sel = window.getSelection();
    if (!sel) return;
    try {
      sel.removeAllRanges();
      sel.addRange(selectionRef.current);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      selectionRef.current = range.cloneRange();
    }
  };

  const exec = (cmd) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    restoreSelection();
    document.execCommand(cmd, false, null);
    if (cmd === "insertUnorderedList" || cmd === "insertOrderedList") {
      normalizeEditorHTML();
    }
    setContent(editorRef.current.innerHTML);
    saveSelection();
    refreshActiveStates();
  };

  const insertLink = () => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    restoreSelection();
    const url = window.prompt("Enter URL:");
    if (url) {
      document.execCommand("createLink", false, url);
      setContent(editorRef.current.innerHTML);
      saveSelection();
      refreshActiveStates();
    }
  };

  const handleAttachImage = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const imageFiles = files.filter(
      (file) =>
        file.type === "image/png" ||
        file.type === "image/jpeg" ||
        file.type === "image/jpg"
    );

    if (imageFiles.length === 0) {
      Swal.fire({
        icon: "error",
        title: "Invalid File Type",
        text: "Please select only PNG, JPG, or JPEG images.",
        confirmButtonColor: MAROON,
      });
      return;
    }

    // Store files as new images with preview URLs
    const newImageObjects = imageFiles.map((file) => ({
      id: Date.now() + Math.random(),
      file: file,
      name: file.name,
      previewUrl: URL.createObjectURL(file), // For preview only
      isNew: true,
    }));

    setNewImages((prev) => [...prev, ...newImageObjects]);
    e.target.value = ""; // Reset file input
  };

  const removeImage = async (imageId, isNewImage = false) => {
    if (isNewImage) {
      // Remove from new images and revoke object URL
      setNewImages((prev) => {
        const imageToRemove = prev.find((img) => img.id === imageId);
        if (imageToRemove?.previewUrl) {
          URL.revokeObjectURL(imageToRemove.previewUrl);
        }
        return prev.filter((img) => img.id !== imageId);
      });
    } else {
      // Remove from existing attached images and mark for deletion from Supabase
      const imageToRemove = attachedImages.find((img) => img.id === imageId);
      if (imageToRemove) {
        // Ask for confirmation before deleting from Supabase
        const result = await Swal.fire({
          title: "Remove Image?",
          text: "This image will be removed when you save the note.",
          icon: "warning",
          showCancelButton: true,
          confirmButtonColor: MAROON,
          cancelButtonColor: "#6c757d",
          confirmButtonText: "Yes, remove it!",
          cancelButtonText: "Cancel",
          reverseButtons: true,
        });

        if (result.isConfirmed) {
          setImagesToDelete((prev) => [...prev, imageToRemove]);
          setAttachedImages((prev) => prev.filter((img) => img.id !== imageId));
        }
      }
    }
  };

  const viewImage = (imageUrl, imageName) => {
    Swal.fire({
      html: `<div class="text-center">
        <img src="${imageUrl}" alt="${imageName}" class="max-w-full max-h-[70vh] mx-auto rounded-lg" />
        <p class="mt-2 text-sm text-gray-600">${imageName}</p>
      </div>`,
      showConfirmButton: false,
      showCloseButton: true,
      showDenyButton: true,
      denyButtonText: `<div class="flex items-center gap-1"><Download class="w-4 h-4" /> Download</div>`,
      denyButtonColor: MAROON,
      width: "auto",
      padding: "20px",
      background: "transparent",
      backdrop: "rgba(0,0,0,0.8)",
      customClass: {
        closeButton:
          "!text-white !text-2xl !top-4 !right-4 !hover:text-gray-300",
        denyButton:
          "!bg-[#3B0304] !border-[#3B0304] !text-white !hover:bg-[#2A0203]",
      },
      preDeny: () => {
        downloadImage(imageUrl, imageName);
        return false; // Prevent modal from closing
      },
    });
  };

  const onInput = () => {
    if (editorRef.current) {
      normalizeEditorHTML();
      setContent(editorRef.current.innerHTML);
      refreshActiveStates();
    }
  };

  const onPaste = (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData(
      "text/plain"
    );
    document.execCommand("insertText", false, text);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const userId = auth.currentUser?.uid || localStorage.getItem("uid");
      if (!userId) {
        throw new Error("User not authenticated");
      }

      // Delete images marked for deletion from Supabase
      if (imagesToDelete.length > 0) {
        const deletePromises = imagesToDelete.map(async (image) => {
          if (image.fileName) {
            await deleteImageFromSupabase(image.fileName);
          }
        });
        await Promise.allSettled(deletePromises);
      }

      // Upload new images to Supabase
      let uploadedImages = [];
      if (newImages.length > 0) {
        const uploadPromises = newImages.map(async (image) => {
          const uploadResult = await uploadImageToSupabase(image.file, userId);
          return {
            id: image.id,
            name: uploadResult.originalName,
            fileName: uploadResult.fileName,
            url: uploadResult.url,
            uploadedAt: new Date().toISOString(),
          };
        });

        uploadedImages = await Promise.all(uploadPromises);

        // Clean up preview URLs
        newImages.forEach((image) => {
          if (image.previewUrl) {
            URL.revokeObjectURL(image.previewUrl);
          }
        });
      }

      // Combine existing images with newly uploaded ones
      const allAttachedImages = [...attachedImages, ...uploadedImages];

      // Call onSave with the complete data
      await onSave({
        title: title.trim(),
        content,
        attachedImages: allAttachedImages,
      });

      // Show success message
      Swal.fire({
        icon: "success",
        title: existing ? "Note Updated" : "Note Created",
        text: existing 
          ? "Your note has been successfully updated."
          : "Your note has been successfully created.",
        confirmButtonColor: MAROON,
        timer: 2000,
      });
    } catch (error) {
      console.error("Save error:", error);
      Swal.fire({
        icon: "error",
        title: "Save Failed",
        text: error.message || "Failed to save note. Please try again.",
        confirmButtonColor: MAROON,
      });
    } finally {
      setSaving(false);
    }
  };

  const refreshActiveStates = () => {
    const isCenter = document.queryCommandState("justifyCenter");
    const isRight = document.queryCommandState("justifyRight");
    const align = isCenter ? "center" : isRight ? "right" : "left";
    setActive({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      strike: document.queryCommandState("strikeThrough"),
      ul: document.queryCommandState("insertUnorderedList"),
      ol: document.queryCommandState("insertOrderedList"),
      align,
    });
  };

  // Clean up object URLs when component unmounts
  useEffect(() => {
    return () => {
      newImages.forEach((image) => {
        if (image.previewUrl) {
          URL.revokeObjectURL(image.previewUrl);
        }
      });
    };
  }, [newImages]);

  const allImages = [...attachedImages, ...newImages];

  return (
    <form
      onSubmit={handleSubmit}
      className="p-0 bg-transparent border-0 shadow-none space-y-3"
    >
      <input
        type="file"
        ref={fileInputRef}
        multiple
        accept=".png,.jpg,.jpeg,image/png,image/jpg,image/jpeg"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-[0_6px_12px_rgba(0,0,0,0.12)]">
        <label className="block mb-1 text-sm font-medium text-neutral-700">
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3B0304]/30"
          placeholder="Enter a descriptive title"
          required
        />
      </div>

      <div className="rounded-2xl overflow-hidden border border-neutral-200 bg-white shadow-[0_6px_12px_rgba(0,0,0,0.12)]">
        <Toolbar
          onCmd={exec}
          onInsertLink={insertLink}
          onAttachImage={handleAttachImage}
          active={active}
        />
        <div
          ref={editorRef}
          className={`min-h-[220px] p-3 text-sm outline-none bg-white ${
            focused ? "ring-2 ring-[#3B0304]/30" : ""
          }`}
          contentEditable
          suppressContentEditableWarning
          onInput={onInput}
          onPaste={onPaste}
          onKeyDown={(e) => {
            if (e.key === "Tab") {
              e.preventDefault();
              if (e.shiftKey) exec("outdent");
              else exec("indent");
            }
          }}
          onFocus={() => {
            setFocused(true);
            saveSelection();
            refreshActiveStates();
          }}
          onBlur={() => {
            setFocused(false);
            saveSelection();
            refreshActiveStates();
          }}
          onKeyUp={() => {
            saveSelection();
            refreshActiveStates();
          }}
          onMouseUp={() => {
            saveSelection();
            refreshActiveStates();
          }}
          onSelect={() => {
            saveSelection();
            refreshActiveStates();
          }}
        />
        {!content && !focused && (
          <div className="pointer-events-none -mt-10 ml-3 text-sm text-neutral-400">
            Start typing your note…
          </div>
        )}
      </div>

      {/* Attached Images Section */}
      {allImages.length > 0 && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-[0_6px_12px_rgba(0,0,0,0.12)]">
          <label className="block mb-3 text-sm font-medium text-neutral-700">
            Attached Images ({allImages.length})
            {newImages.length > 0 && (
              <span className="ml-2 text-sm text-blue-600">
                {newImages.length} new image(s) ready to upload
              </span>
            )}
            {imagesToDelete.length > 0 && (
              <span className="ml-2 text-sm text-red-600">
                {imagesToDelete.length} image(s) marked for deletion
              </span>
            )}
          </label>
          <div className="space-y-2">
            {allImages.map((image) => (
              <div
                key={image.id}
                className="flex items-center justify-between p-2 rounded-lg border border-neutral-200 hover:bg-neutral-50"
              >
                <button
                  type="button"
                  onClick={() =>
                    viewImage(image.url || image.previewUrl, image.name)
                  }
                  className="text-sm text-[#3B0304] hover:underline cursor-pointer flex-1 text-left truncate"
                  title={image.name}
                >
                  {image.name}
                  {image.isNew && (
                    <span className="ml-2 text-xs text-blue-600">(new)</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => removeImage(image.id, image.isNew)}
                  className="p-1 rounded-md hover:bg-neutral-200 cursor-pointer ml-2 flex-shrink-0"
                  aria-label={`Remove ${image.name}`}
                >
                  <X className="w-4 h-4 text-neutral-600" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm text-white shadow hover:shadow-md cursor-pointer bg-[#3B0304] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : existing ? "Save Changes" : "Create Note"}
        </button>
      </div>
    </form>
  );
}

/* ---------------- MAIN ---------------- */
function Notes() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingNote, setEditingNote] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const location = useLocation();
  const seg1 = (location.pathname.split("/")[1] || "").toLowerCase();
  const resolved = roleRoutingMap[seg1] || roleRoutingMap.adviser; // default

  const uid = auth.currentUser?.uid || localStorage.getItem("uid") || "";
  const roleName = resolved.role;
  const roleDocId = resolved.doc;
  const subColName = resolved.sub;

  // destination collection (new desired location)
  const destCol = collection(db, `notes/${roleDocId}/${subColName}`);

  /* ---- one-time migrations from older layouts to new nested layout ---- */
  useEffect(() => {
    const migrateIfNeeded = async () => {
      if (!uid) return;
      try {
        const flagKey = `tsit_notes_migrated:v2:${uid}:${roleDocId}:${subColName}`;
        if (localStorage.getItem(flagKey) === "1") return;

        const destHasAtLeastOne = await getDocs(
          query(destCol, where("uid", "==", uid), limit(1))
        );
        if (!destHasAtLeastOne.empty) {
          localStorage.setItem(flagKey, "1");
          return;
        }

        // sources to migrate from (old shapes)
        const userSubCol = collection(db, `users/${uid}/${subColName}`); // old: users/{uid}/adviserNotes etc
        const legacyTopLevel = collection(db, subColName); // old: adviserNotes etc (top-level)

        const sources = [
          { ref: userSubCol, deleteAfter: true },
          { ref: legacyTopLevel, deleteAfter: true, filterByUid: true },
        ];

        for (const src of sources) {
          const snap = await getDocs(src.ref);
          if (snap.empty) continue;

          const tasks = snap.docs.map(async (d) => {
            const data = d.data() || {};
            if (src.filterByUid && data.uid && data.uid !== uid) return;

            const newRef = doc(db, `notes/${roleDocId}/${subColName}/${d.id}`); // keep same id when possible
            await setDoc(
              newRef,
              {
                uid,
                role: roleName,
                title: data.title || "",
                content: data.content || "",
                attachedImages: data.attachedImages || [],
                createdAt: data.createdAt || serverTimestamp(),
                email: data.email || auth.currentUser?.email || "",
                migratedAt: serverTimestamp(),
              },
              { merge: true }
            );

            if (src.deleteAfter) {
              try {
                await deleteDoc(d.ref);
              } catch {}
            }
          });

          await Promise.all(tasks);
        }

        localStorage.setItem(flagKey, "1");
      } catch (e) {
        console.error("Notes migration error:", e);
      }
    };

    migrateIfNeeded();
  }, [uid, roleDocId, subColName, roleName, destCol]);

  /* ---- live subscription to the new nested location ---- */
  useEffect(() => {
    if (!uid) return;
    const qRef = query(
      destCol,
      where("uid", "==", uid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(
      qRef,
      (snap) => {
        setNotes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (e) => {
        console.error(e);
        setError(e.message || "Failed to load notes.");
        setLoading(false);
      }
    );
    return () => unsub();
  }, [uid, destCol]);

  /* ---- CRUD ---- */
  const handleCreate = () => {
    setEditingNote(null);
    setShowForm(true);
  };
  const handleEdit = (note) => {
    setEditingNote(note);
    setShowForm(true);
  };
  const handleAskDelete = (note) => setConfirmDelete(note);

  const handleDelete = async () => {
    const note = confirmDelete;
    if (!note) return;
    try {
      // Delete associated images from Supabase
      if (note.attachedImages && note.attachedImages.length > 0) {
        const deletePromises = note.attachedImages.map((image) =>
          deleteImageFromSupabase(image.fileName)
        );
        await Promise.allSettled(deletePromises);
      }

      // Delete note from Firebase
      await deleteDoc(doc(db, `notes/${roleDocId}/${subColName}/${note.id}`));
      
      // Show success message
      Swal.fire({
        icon: "success",
        title: "Note Deleted",
        text: "Your note has been successfully deleted.",
        confirmButtonColor: MAROON,
        timer: 2000,
      });
    } catch (e) {
      console.error("Delete error:", e);
      Swal.fire({
        icon: "error",
        title: "Delete Failed",
        text: e.message || "Failed to delete note. Please try again.",
        confirmButtonColor: MAROON,
      });
    } finally {
      setConfirmDelete(null);
    }
  };

  const handleSave = async (data) => {
    try {
      if (editingNote) {
        await updateDoc(
          doc(db, `notes/${roleDocId}/${subColName}/${editingNote.id}`),
          {
            title: data.title,
            content: data.content,
            attachedImages: data.attachedImages || [],
            updatedAt: serverTimestamp(),
          }
        );
      } else {
        await addDoc(destCol, {
          uid,
          role: roleName,
          title: data.title,
          content: data.content,
          attachedImages: data.attachedImages || [],
          createdAt: serverTimestamp(),
          email: auth.currentUser?.email || "",
        });
      }
      setShowForm(false);
      setEditingNote(null);
    } catch (e) {
      console.error("Save error:", e);
      throw e; // Re-throw to be caught in NoteForm
    }
  };

  const anyModalOpen = showForm || !!confirmDelete;

  return (
    <div className="space-y-4">
      {/* ===== Title + underline ===== */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[18px] font-semibold text-black">
          <ClipboardList className="w-5 h-5" />
          <span>Notes</span>
        </div>
        {/* Divider with rounded edges */}
        <div className="h-1 w-full rounded-full" style={{ backgroundColor: MAROON }} />
      </div>

      <button
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white shadow hover:shadow-md cursor-pointer transition-all duration-300 hover:translate-y-[-2px] hover:bg-[#2A0203] ${
          anyModalOpen ? "opacity-60 pointer-events-none" : ""
        } bg-[#3B0304]`}
        onClick={handleCreate}
        disabled={anyModalOpen}
        aria-disabled={anyModalOpen}
      >
        <Plus className="w-4 h-4" /> Create Note
      </button>

      {/* form modal */}
      {showForm && (
        <Modal
          title={editingNote ? "Edit Note" : "Create Note"}
          onClose={() => {
            setShowForm(false);
            setEditingNote(null);
          }}
        >
          <NoteForm
            existing={editingNote}
            onSave={handleSave}
            onCancel={() => {
              setShowForm(false);
              setEditingNote(null);
            }}
          />
        </Modal>
      )}

      {/* confirm delete */}
      {confirmDelete && (
        <ConfirmationDialog
          title="Delete Note"
          message="Are you sure you want to delete this note? This will also delete all attached images. This action cannot be undone."
          confirmText="Delete"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* states */}
      {loading && !error && <p className="text-neutral-500">Loading notes…</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && notes.length === 0 && (
        <p className="text-neutral-500">
          No notes yet. Click "Create Note" to get started.
        </p>
      )}

      {/* grid */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {notes.map((note, idx) => (
          <NoteCard
            key={note.id}
            note={note}
            index={idx}
            onEdit={handleEdit}
            onAskDelete={handleAskDelete}
          />
        ))}
      </div>
    </div>
  );
}

export default Notes;