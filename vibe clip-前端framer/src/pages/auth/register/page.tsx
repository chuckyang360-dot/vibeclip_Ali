import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agree, setAgree] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("请输入邮箱");
      return;
    }
    if (!password || password.length < 6) {
      setError("密码至少需要 6 位");
      return;
    }
    if (password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }
    if (!agree) {
      setError("请同意服务协议和隐私政策");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigate("/projects");
    }, 800);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F7F8FA", fontFamily: "'Inter', sans-serif" }}>
      <header className="flex items-center justify-between px-6 lg:px-10 h-14"
        style={{ background: "rgba(255,255,255,0.96)", backdropFilter: "blur(16px)", borderBottom: "1px solid #EAEAEA" }}
      >
        <a href="/" className="flex items-center gap-2 cursor-pointer group" style={{ textDecoration: "none" }}>
          <div className="w-7 h-7 flex items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105" style={{ background: "linear-gradient(135deg, #7C3AED, #A78BFA)" }}>
            <i className="ri-film-line text-white text-[13px]" />
          </div>
          <span className="text-[14px] font-bold whitespace-nowrap hidden sm:inline" style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}>VibeClip</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md hidden sm:inline" style={{ background: "#F5F3FF", color: "#7C3AED" }}>维播</span>
        </a>
        <a href="/" className="text-[13px] font-medium transition-colors duration-150 cursor-pointer" style={{ color: "#8E8E93", textDecoration: "none" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#1D1D1F"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#8E8E93"; }}
        >
          返回首页
        </a>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-[400px]">
          <div className="bg-white rounded-2xl p-7 md:p-8" style={{ border: "1px solid #EAEAEA", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
            <div className="text-center mb-7">
              <h1 className="text-[22px] md:text-[24px] font-black mb-2" style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}>创建账号</h1>
              <p className="text-[13px]" style={{ color: "#8E8E93" }}>注册 VibeClip，开始高效内容创作</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-[12.5px] font-semibold mb-1.5" style={{ color: "#1D1D1F" }}>邮箱</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
                    <i className="ri-mail-line text-[15px]" style={{ color: "#8E8E93" }} />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    placeholder="your@email.com"
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl text-[13.5px] outline-none transition-all duration-200"
                    style={{ border: "1px solid #EAEAEA", background: "#FAFAFA", color: "#1D1D1F" }}
                    onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#7C3AED"; (e.currentTarget as HTMLElement).style.background = "#ffffff"; }}
                    onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#EAEAEA"; (e.currentTarget as HTMLElement).style.background = "#FAFAFA"; }}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[12.5px] font-semibold mb-1.5" style={{ color: "#1D1D1F" }}>密码</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
                    <i className="ri-lock-line text-[15px]" style={{ color: "#8E8E93" }} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    placeholder="至少 6 位字符"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl text-[13.5px] outline-none transition-all duration-200"
                    style={{ border: "1px solid #EAEAEA", background: "#FAFAFA", color: "#1D1D1F" }}
                    onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#7C3AED"; (e.currentTarget as HTMLElement).style.background = "#ffffff"; }}
                    onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#EAEAEA"; (e.currentTarget as HTMLElement).style.background = "#FAFAFA"; }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center cursor-pointer"
                  >
                    <i className={showPassword ? "ri-eye-line" : "ri-eye-off-line"} style={{ color: "#8E8E93", fontSize: "15px" }} />
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-[12.5px] font-semibold mb-1.5" style={{ color: "#1D1D1F" }}>确认密码</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
                    <i className="ri-lock-line text-[15px]" style={{ color: "#8E8E93" }} />
                  </div>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => { setConfirm(e.target.value); setError(""); }}
                    placeholder="再次输入密码"
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl text-[13.5px] outline-none transition-all duration-200"
                    style={{ border: "1px solid #EAEAEA", background: "#FAFAFA", color: "#1D1D1F" }}
                    onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#7C3AED"; (e.currentTarget as HTMLElement).style.background = "#ffffff"; }}
                    onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#EAEAEA"; (e.currentTarget as HTMLElement).style.background = "#FAFAFA"; }}
                  />
                </div>
              </div>

              {/* Agreement */}
              <label className="flex items-start gap-2.5 cursor-pointer">
                <div
                  className="w-4 h-4 flex items-center justify-center rounded cursor-pointer transition-colors duration-150 shrink-0 mt-0.5"
                  style={{ border: agree ? "1px solid #7C3AED" : "1px solid #D4D4D8", background: agree ? "#7C3AED" : "#ffffff" }}
                  onClick={() => { setAgree(!agree); setError(""); }}
                >
                  {agree && <i className="ri-check-line text-white text-[11px]" />}
                </div>
                <span className="text-[12.5px] leading-relaxed" style={{ color: "#6E6E73" }}>
                  我已阅读并同意
                  <a href="/terms" className="transition-colors duration-150" style={{ color: "#7C3AED", textDecoration: "none" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#5B21B6"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#7C3AED"; }}
                  >《服务协议》</a>
                  和
                  <a href="/privacy" className="transition-colors duration-150" style={{ color: "#7C3AED", textDecoration: "none" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#5B21B6"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#7C3AED"; }}
                  >《隐私政策》</a>
                </span>
              </label>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "#FEF2F2" }}>
                  <i className="ri-error-warning-line text-[14px]" style={{ color: "#EF4444" }} />
                  <span className="text-[12.5px]" style={{ color: "#DC2626" }}>{error}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-[14px] font-bold cursor-pointer whitespace-nowrap transition-opacity duration-200 flex items-center justify-center gap-2"
                style={{ background: "#1D1D1F", color: "#ffffff", opacity: loading ? 0.7 : 1 }}
              >
                {loading && <i className="ri-loader-4-line animate-spin text-[16px]" />}
                {loading ? "注册中..." : "注册"}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1" style={{ height: "1px", background: "#F0F0F5" }} />
              <span className="text-[12px]" style={{ color: "#AEAEB2" }}>或通过以下方式注册</span>
              <div className="flex-1" style={{ height: "1px", background: "#F0F0F5" }} />
            </div>

            {/* Social register placeholders */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-medium cursor-pointer whitespace-nowrap transition-colors duration-150"
                style={{ border: "1px solid #EAEAEA", background: "#ffffff", color: "#444444" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#F5F5F7"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#ffffff"; }}
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-wechat-fill text-[15px]" style={{ color: "#07C160" }} />
                </div>
                微信注册
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-medium cursor-pointer whitespace-nowrap transition-colors duration-150"
                style={{ border: "1px solid #EAEAEA", background: "#ffffff", color: "#444444" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#F5F5F7"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#ffffff"; }}
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-google-fill text-[15px]" style={{ color: "#EA4335" }} />
                </div>
                Google 注册
              </button>
            </div>

            {/* Login link */}
            <p className="text-center text-[13px] mt-6" style={{ color: "#8E8E93" }}>
              已有账号？
              <button
                type="button"
                onClick={() => navigate("/auth/login")}
                className="font-semibold cursor-pointer transition-colors duration-150"
                style={{ color: "#7C3AED", background: "none", border: "none", padding: 0 }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#5B21B6"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#7C3AED"; }}
              >
                立即登录
              </button>
            </p>
          </div>
        </div>
      </main>

      <footer className="py-6 px-6 text-center">
        <p className="text-[12px]" style={{ color: "#AEAEB2" }}>© 2026 VibeClip. All rights reserved.</p>
      </footer>
    </div>
  );
}