import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="relative flex flex-col items-center justify-center h-screen text-center px-4" style={{ background: "#F7F8FA" }}>
      <h1 className="absolute bottom-0 text-9xl md:text-[12rem] font-black select-none pointer-events-none z-0" style={{ color: "#EAEAEA" }}>
        404
      </h1>
      <div className="relative z-10">
        <div className="w-14 h-14 flex items-center justify-center rounded-2xl mx-auto mb-6" style={{ background: "#EAEAEA" }}>
          <i className="ri-film-line text-[22px]" style={{ color: "#8E8E93" }} />
        </div>
        <h1 className="text-xl md:text-2xl font-bold mt-6" style={{ color: "#1D1D1F", fontFamily: "'Syne', sans-serif" }}>
          页面未找到
        </h1>
        <p className="mt-3 text-[15px]" style={{ color: "#8E8E93" }}>
          你访问的页面不存在，或者已经被移除。
        </p>
        <button
          onClick={() => navigate("/")}
          className="mt-8 flex items-center gap-2 px-6 py-3 rounded-xl text-[14px] font-semibold cursor-pointer transition-all duration-200 whitespace-nowrap mx-auto"
          style={{ background: "#1D1D1F", color: "#ffffff" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#374151"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#1D1D1F"; }}
        >
          <i className="ri-arrow-left-line text-[13px]" />
          返回首页
        </button>
      </div>
    </div>
  );
}