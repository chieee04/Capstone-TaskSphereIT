export default function LoginFooter() {
  return (
    <footer className="w-full">
      {/* thinner brand accent bar */}
      <div className="h-[3px] bg-[#6A0F14]" />

      {/* footer base with subtle top divider and soft elevation */}
      <div className="bg-white border-t border-neutral-100 shadow-[0_-4px_8px_rgba(0,0,0,0.05)]">
        <div className="max-w-5xl mx-auto px-4">
          <p className="text-center text-xs text-neutral-600 py-4">
            ©2025 TaskSphere IT — All Rights Reserved
          </p>
        </div>
      </div>
    </footer>
  );
}
