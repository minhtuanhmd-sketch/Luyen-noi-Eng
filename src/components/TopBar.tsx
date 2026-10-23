import React, { useState } from 'react';
import { Moon, Sun, Users, ChevronDown, Check } from 'lucide-react';
import { UserProfile } from '../types/sla';
import { PWAInstallButton, OfflineIndicator } from './PWAInstallButton';

export type ActiveTab = 'studio' | 'levels' | 'library' | 'matrix' | 'syntax' | 'profiles' | 'pedagogy';

interface TopBarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  profiles: UserProfile[];
  activeProfile: UserProfile;
  onSelectProfile: (profileId: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  isDarkMode,
  onToggleDarkMode,
  profiles,
  activeProfile,
  onSelectProfile,
}) => {
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const navItems: { id: ActiveTab; label: string; icon: string }[] = [
    { id: 'studio', label: 'Luyện Tập', icon: '🎙️' },
    { id: 'levels', label: 'Trình Độ A2·B1·B2', icon: '🎯' },
    { id: 'library', label: '60 Mẫu Câu', icon: '📚' },
    { id: 'matrix', label: '20 Biến Thể', icon: '📋' },
    { id: 'syntax', label: 'Cú Pháp & Từ', icon: '✍️' },
    { id: 'profiles', label: 'Gia Đình', icon: '👨‍👩‍👧' },
    { id: 'pedagogy', label: 'Nguyên Lý SLA', icon: 'ℹ️' },
  ];

  return (
    <header className="shrink-0 bg-white dark:bg-[#0F172A] border-b border-slate-200 dark:border-slate-800 transition-colors pt-safe z-30">
      <div className="flex items-center justify-between gap-2 px-3 sm:px-6 py-2.5">
        {/* Brand & Wordmark */}
        <div className="flex items-center gap-2 shrink-0">
          <a
            href="#studio"
            onClick={(e) => {
              e.preventDefault();
              onSelectTab('studio');
            }}
            className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-serif-display whitespace-nowrap"
          >
            LexiSpeak VN
          </a>

          {/* Quick Profile Switcher Dropdown (Tôi, Vợ, Con) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileDropdownOpen((prev) => !prev)}
              aria-label="Chọn người học trong gia đình"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-sky-50 dark:bg-sky-950/70 border border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-200 hover:bg-sky-100 dark:hover:bg-sky-900/80 transition-colors touch-target"
            >
              <span className="text-base">{activeProfile.avatar}</span>
              <span className="max-w-[70px] sm:max-w-[100px] truncate">{activeProfile.name}</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-70" />
            </button>

            {profileDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setProfileDropdownOpen(false)}
                />
                <div className="absolute left-0 mt-2 w-52 rounded-2xl bg-white dark:bg-[#151F32] border border-slate-200 dark:border-slate-700 shadow-xl py-2 z-50 space-y-1">
                  <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Đổi người học (Không cần đăng nhập)
                  </div>
                  {profiles.map((p) => {
                    const isSelected = p.id === activeProfile.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          onSelectProfile(p.id);
                          setProfileDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center justify-between transition-colors ${
                          isSelected
                            ? 'bg-sky-50 dark:bg-sky-950/70 text-[#0284C7] dark:text-sky-300'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-base">{p.avatar}</span>
                          <span className="truncate">{p.name}</span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            ({p.roleDescription})
                          </span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-[#0284C7] dark:text-sky-400 shrink-0" />}
                      </button>
                    );
                  })}
                  <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectTab('profiles');
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full px-3 py-1.5 text-left text-xs font-medium text-[#0284C7] dark:text-sky-400 hover:underline flex items-center gap-1.5"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Quản lý hồ sơ gia đình...</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Center: Desktop Navigation Tabs */}
        <nav
          aria-label="Điều hướng chính"
          className="hidden md:flex items-center gap-1.5 overflow-x-auto p-1 bg-slate-100 dark:bg-[#151F32] rounded-xl border border-slate-200 dark:border-slate-800"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-white dark:bg-sky-600 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Action: Offline status, iOS PWA Install & Hardware Modal, and Dark/Light Mode toggle */}
        <div className="flex items-center gap-1.5 shrink-0">
          <OfflineIndicator />
          <PWAInstallButton onOpenBackupSection={() => onSelectTab('profiles')} />
          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label={isDarkMode ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl border transition-colors touch-target flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
          >
            {isDarkMode ? (
              <>
                <Sun className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="hidden sm:inline text-xs font-semibold">Tối</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-sky-500 shrink-0" />
                <span className="hidden sm:inline text-xs font-semibold">Sáng</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Top Navigation Tab Bar (Clean horizontal scroll, touch-friendly, fits single screen) */}
      <div className="md:hidden flex items-center gap-1 px-2.5 py-1.5 overflow-x-auto border-t border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-[#0B1120]">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 touch-target ${
                isActive
                  ? 'bg-slate-900 dark:bg-sky-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 bg-white/70 dark:bg-slate-800/60'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
