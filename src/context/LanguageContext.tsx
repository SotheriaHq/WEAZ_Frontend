/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useContext } from 'react';
import type { ReactNode } from 'react';

// Define the shape of the context
interface LanguageContextType {
  language: string;
  setLanguage: (language: string) => void;
  translate: (key: string) => string;
}

// Create the context
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Define the translations
const translations: Record<string, Record<string, string>> = {
  en: {
    // Sidebar
    home: 'Home',
    market: 'Market',
    about: 'About',
    troubleshooting: 'Troubleshooting',
    signUp: 'Sign Up',
    // Navbar
    searchPlaceholder: "Search brands, products, styles...",
    filters: "Filters",
    notifications: "Notifications",
    profile: "Profile",
    settings: "Settings",
    theme: "Theme",
    language: "Language",
    location: "Share Location",
    signOut: "Sign Out",
    signIn: "Sign In",
  },
  zh: {
    // Sidebar
    market: 'Market',
    home: '主页',
    about: '关于',
    troubleshooting: '故障排除',
    signUp: '注册',
    // Navbar
    searchPlaceholder: "搜索品牌、产品、款式...",
    filters: "筛选",
    notifications: "通知",
    profile: "个人资料",
    settings: "设置",
    theme: "主题",
    language: "语言",
    location: "分享位置",
    signOut: "登出",
    signIn: "登录",
  },
  ar: {
    // Sidebar
    market: 'Market',
    home: 'الرئيسية',
    about: 'حول',
    troubleshooting: 'استكشاف الأخطاء وإصلاحها',
    signUp: 'التسجيل',
    // Navbar
    searchPlaceholder: "ابحث عن الماركات والمنتجات والأنماط...",
    filters: "المرشحات",
    notifications: "الإشعارات",
    profile: "الملف الشخصي",
    settings: "الإعدادات",
    theme: "المظهر",
    language: "اللغة",
    location: "مشاركة الموقع",
    signOut: "تسجيل الخروج",
    signIn: "تسجيل الدخول",
  },
  hi: {
    // Sidebar
    market: 'Market',
    home: 'घर',
    about: 'बारे में',
    troubleshooting: 'समस्या निवारण',
    signUp: 'साइन अप करें',
    // Navbar
    searchPlaceholder: "ब्रांड, उत्पाद, स्टाइल खोजें...",
    filters: "फ़िल्टर",
    notifications: "सूचनाएं",
    profile: "प्रोफ़ाइल",
    settings: "सेटिंग्स",
    theme: "थीम",
    language: "भाषा",
    location: "स्थान साझा करें",
    signOut: "साइन आउट",
    signIn: "साइन इन करें",
  },
};

// Create the provider component
export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState('en');

  const translate = (key: string) => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, translate }}>
      {children}
    </LanguageContext.Provider>
  );
};

// Create a custom hook to use the context
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

