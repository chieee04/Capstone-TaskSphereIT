import TSLogo from "../../assets/imgs/TaskSphereLogo.png";

export default function LoginHeader() {
  return (
    <div className="bg-neutral-100 border-b border-neutral-200 px-8 py-3 flex items-center gap-3 rounded-t-2xl">
      <img src={TSLogo} alt="TaskSphere IT" className="h-10 w-16" />
      {/* brand color from mock: #6A0F14 */}
      <span className="text-lg font-semibold text-[#6A0F14]">
        TaskSphere IT
      </span>
    </div>
  );
}
