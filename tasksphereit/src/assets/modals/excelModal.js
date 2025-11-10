import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";

const MySwal = withReactContent(Swal);

import { saveImportedUsers } from "../scripts/enroll.js";

const ExcelModal = {
  show: ({
    rows,
    parsing,
    saving,
    err,
    onFileChange,
    onClose,
    selectedType = "Student", // Default type as Student
    saveImportedRows, // (kept for signature compatibility)
  }) => {
    let currentType = selectedType;

    // -- keep ONLY the four fields we care about; ignore everything else ----
    const pick = (obj, candidates = []) => {
      for (const k of candidates) {
        if (obj && obj[k] != null && String(obj[k]).trim() !== "")
          return String(obj[k]).trim();
      }
      return "";
    };

    const normalizeOne = (r = {}) => {
      // accept common header variants from spreadsheets
      const idNumber = pick(r, [
        "idNumber",
        "ID Number",
        "Id Number",
        "ID",
        "Id",
        "Student Number",
      ]);
      const lastName = pick(r, [
        "lastName",
        "Last Name",
        "Lastname",
        "SURNAME",
      ]);
      const firstName = pick(r, [
        "firstName",
        "First Name",
        "Firstname",
        "Given Name",
        "Given",
      ]);
      const middleName = pick(r, [
        "middleName",
        "Middle Name",
        "Middlename",
        "Middle",
        "MI",
        "Middle Initial",
      ]);

      return {
        _select: r._select ?? true,
        idNumber,
        lastName,
        firstName,
        middleName, // keep full middle name; we render it as-is
      };
    };

    // sanitize the incoming rows in-place list for consistent usage below
    let rowsData = Array.isArray(rows) ? rows.map(normalizeOne) : [];

    // ----------------------------------------------------------------------

    const handleAttachFile = () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = [
        ".xlsx",
        ".xlsb",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel.sheet.binary.macroEnabled.12",
        "application/vnd.ms-excel.sheet.binary.macroenabled.12",
      ].join(",");
      input.onchange = (e) => onFileChange(e);
      input.click();
    };

    const handleReset = () => {
      rowsData = [];
      ExcelModal.show({
        rows: [],
        parsing: false,
        saving: false,
        err: "",
        onFileChange,
        onClose,
        selectedType: currentType,
        saveImportedRows,
      });
    };

    const renderRadioButtons = () => `
      <div class="mb-4 flex items-center gap-6">
        <label class="flex items-center gap-2 cursor-pointer">
          <input 
            type="radio" 
            name="user-type" 
            value="Student" 
            ${currentType === "Student" ? "checked" : ""} 
            class="w-4 h-4 text-[#6A0F14] focus:ring-[#6A0F14]"
          />
          <span class="text-sm font-medium text-neutral-700">Student</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input 
            type="radio" 
            name="user-type" 
            value="Adviser" 
            ${currentType === "Adviser" ? "checked" : ""} 
            class="w-4 h-4 text-[#6A0F14] focus:ring-[#6A0F14]"
          />
          <span class="text-sm font-medium text-neutral-700">Adviser</span>
        </label>
      </div>
    `;

    const renderAttachButton = () => `
      <button
        id="attach-file-btn"
        class="inline-flex items-center justify-center gap-2 text-sm font-medium text-[#6A0F14] px-4 py-2 rounded-lg border border-[#6A0F14] hover:bg-[#6A0F14]/10"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
        </svg>
        Attach File
      </button>
    `;

    const renderTable = () => {
      const rowsHtml = rowsData
        .map(
          (r, i) => `
            <tr class="text-sm">
              <td class="px-4 py-2 text-left">
                <input type="checkbox" class="row-checkbox" data-index="${i}" ${
            r._select ? "checked" : ""
          } />
              </td>
              <td class="px-4 py-2 text-left">${r.idNumber || ""}</td>
              <td class="px-4 py-2 text-left">${r.lastName || ""}</td>
              <td class="px-4 py-2 text-left">${r.firstName || ""}</td>
              <td class="px-4 py-2 text-left">${r.middleName || ""}</td>
            </tr>
          `
        )
        .join("");

      const allChecked =
        rowsData.length > 0 && rowsData.every((r) => r._select);

      return `
        <div class="border border-neutral-200 rounded-xl overflow-hidden">
          <div class="overflow-auto max-h-96">
            <table class="min-w-full divide-y divide-neutral-200">
              <thead class="bg-neutral-100">
                <tr>
                  <th class="px-4 py-2 text-left text-xs font-semibold text-neutral-700">
                    <input type="checkbox" id="select-all" ${
                      allChecked ? "checked" : ""
                    } />
                  </th>
                  <th class="px-4 py-2 text-left text-xs font-semibold text-neutral-700">ID Number</th>
                  <th class="px-4 py-2 text-left text-xs font-semibold text-neutral-700">Last Name</th>
                  <th class="px-4 py-2 text-left text-xs font-semibold text-neutral-700">First Name</th>
                  <th class="px-4 py-2 text-left text-xs font-semibold text-neutral-700">Middle Name</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-neutral-200">${rowsHtml}</tbody>
            </table>
          </div>
        </div>
      `;
    };

    const renderContent = () => {
      let content = renderRadioButtons();

      if (err) {
        content += `
          <div class="mb-4 text-sm text-red-600">${err}</div>
          ${rowsData.length === 0 ? renderAttachButton() : renderTable()}
        `;
      } else if (parsing) {
        content += `<div class="py-10 text-center text-sm text-neutral-600">Reading file…</div>`;
      } else if (rowsData.length === 0) {
        content += ` 
          <div class="text-center mb-4">${renderAttachButton()}</div>
          <div class="py-10 text-center text-sm text-neutral-600">No rows found.</div>
        `;
      } else {
        content += renderTable();
      }

      return content;
    };

    MySwal.fire({
      title: `
        <span class="text-[#6A0F14] text-xl font-semibold" style="display: block; text-align: left;">
          Import Preview (${rowsData.length})
        </span>
      `,
      html: renderContent(),
      width: "56rem",
      showCancelButton: true,
      showDenyButton: true,
      denyButtonText: "Cancel",
      cancelButtonText: "Reset",
      confirmButtonText: saving ? "Saving…" : "Save and Enroll",
      reverseButtons: true,
      buttonsStyling: false,
      allowOutsideClick: false,
      customClass: {
        popup: "rounded-2xl shadow-2xl border border-neutral-200",
        title: "mb-0",
        htmlContainer: "px-6 py-2",
        actions: "px-6 pb-6 flex justify-end gap-3 space-x-4",
        denyButton:
          "px-6 py-2 rounded-full border border-neutral-300 text-sm font-medium text-neutral-700 hover:bg-neutral-100 swal2-styled",
        cancelButton:
          "px-4 py-2 rounded-full border border-[#6A0F14] text-sm font-medium text-[#6A0F14] hover:bg-[#6A0F14]/10 swal2-styled",
        confirmButton:
          "px-6 py-2 rounded-full bg-[#6A0F14] text-sm font-medium text-white hover:bg-[#5c0d12] disabled:opacity-60 swal2-styled",
      },
      didOpen: () => {
        document
          .querySelectorAll('input[name="user-type"]')
          .forEach((radio) => {
            radio.addEventListener("change", (e) => {
              currentType = e.target.value;
            });
          });

        const attachBtn = document.getElementById("attach-file-btn");
        if (attachBtn) attachBtn.addEventListener("click", handleAttachFile);

        const selectAll = document.getElementById("select-all");
        if (selectAll) {
          selectAll.addEventListener("change", (e) => {
            const checked = e.target.checked;
            rowsData.forEach((r) => (r._select = checked));
            document
              .querySelectorAll(".row-checkbox")
              .forEach((cb) => (cb.checked = checked));
          });
        }

        document.querySelectorAll(".row-checkbox").forEach((cb) => {
          cb.addEventListener("change", (e) => {
            const index = parseInt(e.target.dataset.index, 10);
            rowsData[index]._select = e.target.checked;

            const selectAllCheckbox = document.getElementById("select-all");
            if (selectAllCheckbox) {
              selectAllCheckbox.checked = rowsData.every((r) => r._select);
            }
          });
        });
      },
    }).then(async (result) => {
      if (result.isConfirmed) {
        MySwal.fire({
          title: "Saving Users...",
          text: "Please wait while users are being saved.",
          icon: "info",
          allowOutsideClick: false,
          showConfirmButton: false,
          didOpen: () => MySwal.showLoading(),
        });

        try {
          // Only send the four fields (+ _select) and ignore everything else
          const payload = rowsData.map(
            ({ _select, idNumber, lastName, firstName, middleName }) => ({
              _select,
              idNumber,
              lastName,
              firstName,
              middleName,
            })
          );

          await saveImportedUsers(payload, currentType);

          MySwal.fire({
            title: "Success!",
            text: "Users have been saved successfully.",
            icon: "success",
          });
        } catch (error) {
          console.log("Error saving users:", error);
          MySwal.fire({
            title: "Error",
            text: "There was an error saving users.",
            icon: "error",
          });
        }
      } else if (result.isDenied) {
        onClose();
      } else {
        handleReset();
      }
    });
  },
};

export default ExcelModal;
