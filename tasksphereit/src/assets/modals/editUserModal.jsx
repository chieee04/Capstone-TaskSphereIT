//editUserModal.jsx
import React, { useState } from "react";
import { X } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../config/firebase";
import { resetPasswordToDefault } from "../scripts/enroll";
import Swal from "sweetalert2";
import { updateTeamsForUser } from "../../components/CapstoneInstructor/InstructorFunctions/InstructorTeamsFunction";

const EditUserModal = ({
  open,
  form,
  onChange,
  handleSaveUser,
  saving,
  closeModal,
  error,
  roleOptions = ["Adviser", "Project Manager", "Member"],
  lockRole = false,
  isStudent = false,
  mustChangePassword = false,
}) => {
  if (!open) return null;

  const lockedRoleValue = form.role;
  const [password, setPassword] = useState(form.password);
  const [resetPassword, setResetPassword] = useState(false);

  const handleResetPassword = () => {
    setPassword("CCS_dct.2025!");
    setResetPassword(true);
  };

  const handleSave = async () => {
    if (resetPassword) {
      try {
        if (!form.id) throw new Error("User ID is not available.");

        await resetPasswordToDefault({ id: form.id });

        const userRef = doc(db, "users", form.id);
        await updateDoc(userRef, { mustChangePassword: true });

        await Swal.fire({
          icon: "success",
          title: "Success!",
          text: "User updated successfully",
          timer: 1500,
          showConfirmButton: false,
        });

        closeModal();
      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: error.message || "Failed to update user",
          confirmButtonColor: "#6A0F14",
        });
      }
    } else {
      try {
        await handleSaveUser();
await updateTeamsForUser(form);

closeModal(); // ✅ close immediately

setTimeout(() => {
  Swal.fire({
    icon: "success",
    title: "Success!",
    text: "User updated successfully",
    timer: 1500,
    showConfirmButton: false,
  });
}, 200); // small delay para smooth

      } catch (error) {
        console.error("Error saving user:", error);
      }
    }
  };

  const shouldShowResetButton = !mustChangePassword && password !== "CCS_dct.2025!";

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      onClick={closeModal}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative z-10 flex items-center justify-center min-h-full p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-neutral-200">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div className="flex items-center gap-2 text-[#6A0F14]">
              <h3 className="text-lg font-semibold">Edit User</h3>
            </div>
            <button
              className="p-2 rounded-full hover:bg-neutral-100"
              onClick={closeModal}
            >
              <X className="w-5 h-5 text-neutral-600" />
            </button>
          </div>

          <div className="px-6 py-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Last Name */}
              <div>
                <label className="block text-sm font-medium text-neutral-700">
                  Last Name
                </label>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={onChange("lastName")}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6A0F14]/30"
                />
              </div>

              {/* ID Number (Simplified) */}
              <div>
                <label className="block text-sm font-medium text-neutral-700">
                  ID Number
                </label>
                <input
                  type="text"
                  value={form.idNumber}
                  onChange={(e) => {
                    let value = e.target.value.replace(/\D/g, "");
                    value = value.slice(0, 9);
                    onChange("idNumber")({ target: { value } });
                  }}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6A0F14]/30"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Must be 9 Numbers Only.
                </p>
              </div>

              {/* First Name */}
              <div>
                <label className="block text-sm font-medium text-neutral-700">
                  First Name
                </label>
                <input
                  type="text"
                  value={form.firstName}
                  onChange={onChange("firstName")}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6A0F14]/30"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-neutral-700">
                  Password
                </label>
                <input
                  type="text"
                  readOnly
                  value={password}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-neutral-100 text-neutral-500"
                />
                {shouldShowResetButton && (
                  <button
                    onClick={handleResetPassword}
                    className="mt-2 text-sm text-[#6A0F14] hover:text-[#5c0d12]"
                  >
                    Reset to Default
                  </button>
                )}
              </div>

              {/* Middle Initial (Updated) */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-neutral-700">
                  Middle Initial
                </label>
                <input
                  type="text"
                  value={form.middleName}
                  onChange={(e) => {
                    let value = e.target.value.toUpperCase().slice(0, 2);
                    onChange("middleName")({ target: { value } });
                  }}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6A0F14]/30"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-neutral-700">
                  Role
                </label>
                <input
                  type="text"
                  readOnly
                  value={lockedRoleValue}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-neutral-100 text-neutral-700"
                />
              </div>

              {error && (
                <div className="md:col-span-2 text-sm text-red-600">
                  {error}
                </div>
              )}
            </div>
          </div>

          <div className="px-6 pb-6 flex justify-end gap-3">
            <button
              className="px-4 py-2 rounded-full border border-[#6A0F14] text-sm font-medium text-[#6A0F14] hover:bg-[#6A0F14]/10"
              onClick={closeModal}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              className="px-6 py-2 rounded-full bg-[#6A0F14] text-sm font-medium text-white hover:bg-[#5c0d12] disabled:opacity-60"
              onClick={handleSave}
              disabled={
                saving ||
                !form.firstName.trim() ||
                !form.lastName.trim()
              }
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditUserModal;