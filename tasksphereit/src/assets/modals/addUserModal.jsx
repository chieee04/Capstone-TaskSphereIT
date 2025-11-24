// src/components/CapstoneInstructor/AddUserModal.jsx
import React from "react";
import { X, PlusCircle } from "lucide-react";

const AddUserModal = ({
  open,
  form,
  onChange,
  handleSaveUser,
  saving,
  closeModal,
  error,
  // NEW: control which roles are allowed and whether to lock the field
  roleOptions = ["Adviser", "Project Manager", "Member"],
  lockRole = false,
}) => {
  if (!open) return null;

  const singleRole = roleOptions.length === 1;
  const showLockedRole = lockRole || singleRole;
  const lockedRoleValue = singleRole ? roleOptions[0] : form.role;

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
              <PlusCircle className="w-5 h-5" />
              <h3 className="text-lg font-semibold">Add User</h3>
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
              {/* Row 1: Last Name | ID Number */}
              <div>
                <label className="block text-sm font-medium text-neutral-700">
                  Last Name
                </label>
                <input
                  type="text"
                  placeholder="Last Name"
                  value={form.lastName}
                  onChange={onChange("lastName")}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6A0F14]/30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700">
                  ID Number
                </label>
                <input
  type="text"
  placeholder="ID Number"
  value={form.idNumber}
  onChange={(e) => {
    // keep only digits
    const value = e.target.value.replace(/\D/g, "");

    // allow only up to exactly 9 digits
    if (value.length <= 9) {
      onChange("idNumber")({ target: { value } });
    }
  }}
  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6A0F14]/30"
  inputMode="numeric"
  maxLength={9}
/>

<p className="text-xs text-neutral-500 mt-1">
  ID Number must be exactly 9 digits.
</p>

              </div>

              {/* Row 2: First Name | Password */}
              <div>
                <label className="block text-sm font-medium text-neutral-700">
                  First Name
                </label>
                <input
                  type="text"
                  placeholder="First Name"
                  value={form.firstName}
                  onChange={onChange("firstName")}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6A0F14]/30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700">
                  Password
                </label>
                <input
                  type="text"
                  readOnly
                  value="UserUser321"
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-neutral-100 text-neutral-500"
                />
              </div>

              {/* Row 3: Middle Initial | Role */}
              <div>
                <label className="block text-sm font-medium text-neutral-700">
                  Middle Initial
                </label>
                <input
  type="text"
  placeholder="Middle Initial"
  value={form.middleName}
  onChange={(e) => {
    const value = e.target.value.toUpperCase(); // auto uppercase (optional)
    // Allow only alphabetic letters
    if (/^[A-Za-z]?$/.test(value)) {
      onChange("middleName")({ target: { value } });
    }
  }}
  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6A0F14]/30"
  maxLength={1}
/>

              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700">
                  Role
                </label>
                <input
                  type="text"
                  readOnly
                  value={form.role}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-neutral-100 text-neutral-700"
                  title="Role is fixed"
                />
              </div>

              {/* Error message */}
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
  onClick={async () => {
    await handleSaveUser();   // save first
    closeModal();             // close modal immediately

    setTimeout(() => {
      Swal.fire({
        icon: "success",
        title: "Success!",
        text: "User added successfully",
        timer: 1500,
        showConfirmButton: false,
      });
    }, 200);
  }}
  disabled={
    saving ||
    form.idNumber.length !== 9 ||
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

export default AddUserModal;
