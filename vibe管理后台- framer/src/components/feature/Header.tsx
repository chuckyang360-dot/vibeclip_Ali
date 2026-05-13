import { useState } from "react";
import { useTranslation } from "react-i18next";

interface HeaderProps {
  title: string;
  onTimeRangeChange?: (range: string) => void;
}

export default function Header({ title, onTimeRangeChange }: HeaderProps) {
  const { t, i18n } = useTranslation(["common"]);
  const [timeRange, setTimeRange] = useState("Today");
  const [searchValue, setSearchValue] = useState("");

  const timeRanges = [
    { key: "Today", label: t("common:today") },
    { key: "7D", label: t("common:this_7d") },
    { key: "30D", label: t("common:this_30d") },
    { key: "Custom", label: t("common:custom") },
  ];

  const handleRangeClick = (range: string) => {
    setTimeRange(range);
    onTimeRangeChange?.(range);
  };

  const toggleLanguage = () => {
    const next = i18n.language === "zh" ? "en" : "zh";
    i18n.changeLanguage(next);
  };

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-5 sticky top-0 z-40">
      <h1 className="text-base font-semibold text-gray-900">{title}</h1>

      <div className="flex items-center gap-3">
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
          {timeRanges.map((range) => (
            <button
              key={range.key}
              onClick={() => handleRangeClick(range.key)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${timeRange === range.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              {range.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-gray-400">
            <i className="ri-search-line text-sm" />
          </span>
          <input
            type="text"
            placeholder={t("common:header_search")}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="w-52 pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <div className="w-px h-6 bg-gray-200" />

        {/* Language Toggle */}
        <button
          onClick={toggleLanguage}
          className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors whitespace-nowrap"
          title={i18n.language === "zh" ? "Switch to English" : "切换为中文"}
        >
          {i18n.language === "zh" ? "EN" : "中"}
        </button>

        <button className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
          <i className="ri-notification-3-line text-gray-600 text-sm" />
        </button>

        <button className="flex items-center gap-2 hover:bg-gray-50 rounded-lg px-2 py-1 transition-colors">
          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center">
            <i className="ri-user-line text-indigo-600 text-xs" />
          </div>
          <span className="text-xs text-gray-700 font-medium hidden sm:block">{t("common:header_admin")}</span>
        </button>
      </div>
    </header>
  );
}