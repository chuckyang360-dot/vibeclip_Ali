import { useState } from "react";
import { useNavigate } from "react-router-dom";
import UserDropdown from "@/components/feature/UserDropdown";

export default function AccountSettingsPage() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"profile" | "preference" | "security">("profile");

  // Mock user data
  const user = {
    name: "萝大根",
    email: "372099313@qq.com",
    id: "1",
    plan: "免费版用户",
    joinedAt: "2026-04-15",
  };

  const profileFields = [
    { label: "用户名", value: user.name, editable: true },
    { label: "邮箱", value: user.email, editable: true },
    { label: "用户 ID", value: user.id, editable: false },
    { label: "当前登录状态", value: "已登录", editable: false },
    { label: "账号类型", value: user.plan, editable: false },
    { label: "注册时间", value: user.joinedAt, editable: false },
  ];

  const preferenceFields = [
    { label: "默认语言", value: "中文", editable: true },
    { label: "默认工作区", value: "Vibe Clip", editable: false },
    { label: "默认视频比例", value: "9:16", editable: true },
    { label: "默认内容类型", value: "商品营销短视频", editable: true },
    { label: "通知偏好", value: "暂未开放", editable: false },
  ];

  const securityFields = [
    { label: "密码修改", value: "暂未开放", editable: false },
    { label: "登录设备", value: "暂未开放", editable: false },
    { label: "第三方登录", value: "暂未开放", editable: false },
    { label: "账号状态", value: "正常", editable: false },
  ];

  const tabs = [
    { key: "profile" as const, label: "账号信息", icon: "ri-user-3-line" },
    { key: "preference" as const, label: "使用偏好", icon: "ri-settings-3-line" },
    { key: "security" as const, label: "安全", icon: "ri-shield-keyhole-line" },
  ];

  const getFields = () => {
    switch (activeTab) {
      case "profile": return profileFields;
      case "preference": return preferenceFields;
      case "security": return securityFields;
    }
  };

  return (
    <div style={{ background: "#F7F8FA", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      {/* Header — matches landing nav */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 lg:px-10 h-14"
        style={{
          background: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid #EAEAEA",
          boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
        }}
      >
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 cursor-pointer group" style={{ textDecoration: "none" }}>
          <div
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105"
            style={{ background: "linear-gradient(135deg, #7C3AED, #A78BFA)" }}
          >
            <i className="ri-film-line text-white text-[13px]" />
          </div>
          <span className="text-[14px] font-bold whitespace-nowrap hidden sm:inline" style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}>
            VibeClip
          </span>
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-md hidden sm:inline"
            style={{ background: "#F5F3FF", color: "#7C3AED" }}
          >
            维播
          </span>
        </a>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-1">
          {[
            { label: "首页", href: "/" },
            { label: "流程", href: "/#workflow" },
            { label: "案例", href: "/#cases" },
            { label: "项目管理", href: "/projects" },
          ].map((item) => {
            const isActive = item.href === "/account/settings";
            return (
              <a
                key={item.label}
                href={item.href}
                className="px-3.5 py-1.5 text-[13.5px] font-medium rounded-lg cursor-pointer transition-all duration-200 whitespace-nowrap"
                style={{
                  color: isActive ? "#1D1D1F" : "#8E8E93",
                  textDecoration: "none",
                  background: isActive ? "#F5F5F7" : "transparent",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "#1D1D1F";
                  (e.currentTarget as HTMLElement).style.background = "#F5F5F7";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = isActive ? "#1D1D1F" : "#8E8E93";
                  (e.currentTarget as HTMLElement).style.background = isActive ? "#F5F5F7" : "transparent";
                }}
              >
                {item.label}
              </a>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <UserDropdown isLoggedIn={false} />
        </div>
      </header>

      {/* Main content */}
      <main className="pt-14">
        <div className="max-w-[960px] mx-auto px-6 lg:px-10 py-10">
          {/* Page header */}
          <div className="mb-8">
            <h1 className="text-[26px] font-black" style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}>
              账户设置
            </h1>
            <p className="text-[13.5px] mt-1" style={{ color: "#8E8E93" }}>
              管理你的 Vibe Clip 账号信息与基础偏好
            </p>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left sidebar tabs */}
            <div className="w-full lg:w-[200px] shrink-0 space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-[13.5px] font-medium cursor-pointer transition-all duration-200 whitespace-nowrap"
                  style={{
                    background: activeTab === tab.key ? "#F5F3FF" : "transparent",
                    color: activeTab === tab.key ? "#7C3AED" : "#6E6E73",
                  }}
                  onMouseEnter={(e) => {
                    if (activeTab !== tab.key) {
                      (e.currentTarget as HTMLElement).style.background = "#F5F5F7";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== tab.key) {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                    }
                  }}
                >
                  <i className={`${tab.icon} text-[15px]`} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Right cards */}
            <div className="flex-1 space-y-5">
              {/* Card */}
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: "#ffffff", border: "1px solid #EAEAEA" }}
              >
                <div className="px-6 py-4" style={{ borderBottom: "1px solid #F0F0F5" }}>
                  <h2 className="text-[14px] font-bold" style={{ color: "#1D1D1F" }}>
                    {tabs.find((t) => t.key === activeTab)?.label}
                  </h2>
                </div>
                <div className="px-6 py-5 space-y-0">
                  {getFields().map((field, idx) => (
                    <div
                      key={field.label}
                      className="flex items-center justify-between py-3.5"
                      style={{
                        borderBottom: idx < getFields().length - 1 ? "1px solid #F0F0F5" : "none",
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="text-[13px] shrink-0 w-[100px]" style={{ color: "#8E8E93" }}>
                          {field.label}
                        </span>
                        <span className="text-[13.5px] font-medium truncate" style={{ color: "#1D1D1F" }}>
                          {field.value}
                        </span>
                      </div>
                      {field.editable && (
                        <button
                          className="px-3 py-1 rounded-lg text-[12px] font-medium cursor-pointer transition-all duration-200 whitespace-nowrap shrink-0"
                          style={{
                            background: "#F5F5F7",
                            color: "#6E6E73",
                            border: "1px solid #EAEAEA",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.background = "#EAEAEA";
                            (e.currentTarget as HTMLElement).style.color = "#1D1D1F";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background = "#F5F5F7";
                            (e.currentTarget as HTMLElement).style.color = "#6E6E73";
                          }}
                        >
                          修改
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Danger zone — always shown */}
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: "#ffffff", border: "1px solid #EAEAEA" }}
              >
                <div className="px-6 py-4" style={{ borderBottom: "1px solid #F0F0F5" }}>
                  <h2 className="text-[14px] font-bold" style={{ color: "#DC2626" }}>危险操作</h2>
                </div>
                <div className="px-6 py-5 space-y-3">
                  {/* Logout */}
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-[13.5px] font-medium" style={{ color: "#1D1D1F" }}>退出登录</p>
                      <p className="text-[12px] mt-0.5" style={{ color: "#8E8E93" }}>退出当前账号，返回首页</p>
                    </div>
                    <button
                      onClick={() => window.location.replace("/")}
                      className="px-4 py-2 rounded-xl text-[13px] font-semibold cursor-pointer transition-all duration-200 whitespace-nowrap"
                      style={{
                        background: "transparent",
                        color: "#DC2626",
                        border: "1px solid #FECACA",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "#FEF2F2";
                        (e.currentTarget as HTMLElement).style.borderColor = "#FCA5A5";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "transparent";
                        (e.currentTarget as HTMLElement).style.borderColor = "#FECACA";
                      }}
                    >
                      退出登录
                    </button>
                  </div>

                  {/* Divider */}
                  <div style={{ height: "1px", background: "#F0F0F5" }} />

                  {/* Delete account */}
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-[13.5px] font-medium" style={{ color: "#AEAEB2" }}>注销账号</p>
                      <p className="text-[12px] mt-0.5" style={{ color: "#C7C7CC" }}>暂未开放</p>
                    </div>
                    <button
                      disabled
                      className="px-4 py-2 rounded-xl text-[13px] font-medium whitespace-nowrap cursor-not-allowed"
                      style={{
                        background: "#F5F5F7",
                        color: "#C7C7CC",
                        border: "1px solid #EAEAEA",
                      }}
                    >
                      暂未开放
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}