const API_BASE = "https://taskphere-it-email.vercel.app";

export const sendLoginEmail = async ({ email, fullName }) => {
  const res = await fetch(`${API_BASE}/sendLogin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      name: fullName,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Email API returned ${res.status}`);
  }
};
