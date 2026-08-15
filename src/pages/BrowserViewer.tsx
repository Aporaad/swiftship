import React, { useState, useEffect, useRef } from 'react';
import {
  Globe,
  Plus,
  Pin,
  Edit2,
  Trash2,
  ExternalLink,
  RefreshCw,
  Search,
  Lock,
  User,
  Key,
  Shield,
  Layers,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Home,
  RotateCw,
  Truck,
  ShoppingBag,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  Link as LinkIcon,
  Server,
  Monitor
} from 'lucide-react';
import { supabase, collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, addDoc, db } from '../lib/supabase-firebase-adapter';
import { useSettings } from '../context/SettingsContext';
import toast from 'react-hot-toast';

export interface BrowserPageItem {
  id: string;
  name: string;
  url: string;
  username?: string;
  password?: string; // stored base64 encoded
  tabColor?: string;
  isPinned?: boolean;
  sortOrder?: number;
  viewMode?: 'iframe' | 'proxy';
  autoLogin?: boolean;
  category?: 'custom' | 'source' | 'shipping';
  sourceId?: string;
  createdAt?: number;
  updatedAt?: number;
}

const DEFAULT_TAB_COLORS = [
  '#d4af37', // Gold
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#f97316', // Orange
  '#06b6d4', // Cyan
  '#eab308'  // Yellow
];

export default function BrowserViewer() {
  const { settings } = useSettings();
  const isAr = settings.language === 'ar';

  // State
  const [pages, setPages] = useState<BrowserPageItem[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [shippingCompanies, setShippingCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected Page
  const [activePage, setActivePage] = useState<BrowserPageItem | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [currentUrlInput, setCurrentUrlInput] = useState('');

  useEffect(() => {
    if (activePage) {
      setCurrentUrlInput(activePage.url);
    }
  }, [activePage?.id, activePage?.url]);

  // Listen for iframe navigation events from injected proxy script to update URL input live
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'SWIFTSHIP_NAVIGATED' && event.data.url) {
        setCurrentUrlInput(event.data.url);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleGoBack = () => {
    try {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.history.back();
      }
    } catch (_) {}
  };

  const handleGoForward = () => {
    try {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.history.forward();
      }
    } catch (_) {}
  };

  const handleResetHome = () => {
    if (activePage) {
      setCurrentUrlInput(activePage.url);
      setIframeKey(k => k + 1);
    }
  };

  const handleNavigateUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUrlInput.trim() || !activePage) return;
    let target = currentUrlInput.trim();
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = 'https://' + target;
    }
    setActivePage({ ...activePage, url: target });
    setIframeKey(k => k + 1);
  };

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'custom' | 'sources' | 'shipping'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingPage, setEditingPage] = useState<BrowserPageItem | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    username: '',
    password: '',
    tabColor: '#d4af37',
    viewMode: 'proxy' as 'iframe' | 'proxy',
    autoLogin: true,
    isPinned: false
  });

  // Show Password in UI
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<'user' | 'pass' | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // 1. Real-time Subscription to DB table `browser_pages`
  useEffect(() => {
    const unsubPages = onSnapshot(collection(db, 'browser_pages'), (snap: any) => {
      const items: BrowserPageItem[] = snap.docs.map((d: any) => ({
        id: d.id,
        ...d.data()
      }));
      setPages(items);
      setLoading(false);
    }, (err: any) => {
      console.error('[BrowserViewer] Error listening to browser_pages:', err);
      setLoading(false);
    });

    const unsubSources = onSnapshot(collection(db, 'sources'), (snap: any) => {
      setSources(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
    }, (err: any) => console.error(err));

    const unsubShipping = onSnapshot(collection(db, 'shipping_companies'), (snap: any) => {
      setShippingCompanies(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
    }, (err: any) => console.error(err));

    return () => {
      unsubPages();
      unsubSources();
      unsubShipping();
    };
  }, []);

  // 2. Select first available page on load if none selected
  useEffect(() => {
    if (!activePage && pages.length > 0) {
      setActivePage(pages[0]);
    }
  }, [pages, activePage]);

  // Combine custom pages with auto-extracted sources and shipping companies
  const autoSourcePages: BrowserPageItem[] = sources
    .filter(s => s.type === 'App' || s.source_url)
    .map(s => ({
      id: `auto_src_${s.id}`,
      name: s.source_name || s.name || 'متجر تسوق',
      url: s.source_url || 'https://google.com',
      tabColor: '#8b5cf6',
      isPinned: false,
      sortOrder: 990,
      viewMode: 'proxy',
      category: 'source',
      sourceId: s.id
    }));

  const autoShippingPages: BrowserPageItem[] = shippingCompanies
    .filter(c => c.tracking_url)
    .map(c => ({
      id: `auto_ship_${c.id}`,
      name: c.name || 'شركة شحن',
      url: c.tracking_url || 'https://google.com',
      tabColor: '#3b82f6',
      isPinned: false,
      sortOrder: 995,
      viewMode: 'proxy',
      category: 'shipping',
      sourceId: c.id
    }));

  // Combine all pages
  const allDisplayPages = [
    ...pages,
    // Add auto-extracted pages if not already customized in browser_pages
    ...autoSourcePages.filter(asp => !pages.some(p => p.sourceId === asp.sourceId)),
    ...autoShippingPages.filter(asp => !pages.some(p => p.sourceId === asp.sourceId))
  ];

  // Filtered & Sorted
  const filteredPages = allDisplayPages
    .filter(p => {
      const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.url.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchSearch) return false;
      if (activeCategory === 'custom') return p.category !== 'source' && p.category !== 'shipping';
      if (activeCategory === 'sources') return p.category === 'source' || sources.some(s => s.id === p.sourceId);
      if (activeCategory === 'shipping') return p.category === 'shipping' || shippingCompanies.some(c => c.id === p.sourceId);
      return true;
    })
    .sort((a, b) => {
      // Pinned first
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });

  // Open Modal for Add
  const handleOpenAdd = () => {
    setEditingPage(null);
    setFormData({
      name: '',
      url: '',
      username: '',
      password: '',
      tabColor: DEFAULT_TAB_COLORS[Math.floor(Math.random() * DEFAULT_TAB_COLORS.length)],
      viewMode: 'proxy',
      autoLogin: true,
      isPinned: false
    });
    setIsModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEdit = (page: BrowserPageItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPage(page);
    
    // Decode password if base64
    let rawPass = '';
    if (page.password) {
      try {
        rawPass = atob(page.password);
      } catch (_) {
        rawPass = page.password;
      }
    }

    setFormData({
      name: page.name || '',
      url: page.url || '',
      username: page.username || '',
      password: rawPass,
      tabColor: page.tabColor || '#d4af37',
      viewMode: page.viewMode || 'proxy',
      autoLogin: page.autoLogin !== false,
      isPinned: !!page.isPinned
    });
    setIsModalOpen(true);
  };

  // Submit Add / Edit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.url.trim()) {
      toast.error(isAr ? 'يرجى إدخال اسم الصفحة والرابط' : 'Name and URL are required');
      return;
    }

    setSubmitting(true);
    try {
      let finalUrl = formData.url.trim();
      if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = 'https://' + finalUrl;
      }

      const encodedPassword = formData.password ? btoa(formData.password) : '';

      const payload: Partial<BrowserPageItem> = {
        name: formData.name.trim(),
        url: finalUrl,
        username: formData.username.trim(),
        password: encodedPassword,
        tabColor: formData.tabColor,
        viewMode: formData.viewMode,
        autoLogin: formData.autoLogin,
        isPinned: formData.isPinned,
        updatedAt: Date.now()
      };

      if (editingPage) {
        await updateDoc(doc(db, 'browser_pages', editingPage.id), payload);
        toast.success(isAr ? 'تم تحديث بيانات الصفحة بنجاح!' : 'Page updated successfully!');
        if (activePage?.id === editingPage.id) {
          setActivePage({ ...editingPage, ...payload });
        }
      } else {
        const id = `pg_${Date.now()}`;
        const newPage: BrowserPageItem = {
          id,
          name: formData.name.trim(),
          url: finalUrl,
          username: formData.username.trim(),
          password: encodedPassword,
          tabColor: formData.tabColor,
          viewMode: formData.viewMode,
          autoLogin: formData.autoLogin,
          isPinned: formData.isPinned,
          sortOrder: pages.length + 1,
          category: 'custom',
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        await setDoc(doc(db, 'browser_pages', id), newPage);
        toast.success(isAr ? 'تم إضافة الصفحة وحفظ بياناتها بنجاح!' : 'Page saved successfully!');
        setActivePage(newPage);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      console.error('[BrowserViewer] Submit error:', err);
      toast.error(err.message || 'Error saving page');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Pin Status
  const handleTogglePin = async (page: BrowserPageItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const newPinned = !page.isPinned;
      if (page.id.startsWith('auto_')) {
        // Convert auto page to a real record in browser_pages
        const newDocId = `pg_${Date.now()}`;
        const realDoc: BrowserPageItem = {
          ...page,
          id: newDocId,
          isPinned: newPinned,
          updatedAt: Date.now()
        };
        await setDoc(doc(db, 'browser_pages', newDocId), realDoc);
      } else {
        await updateDoc(doc(db, 'browser_pages', page.id), {
          isPinned: newPinned,
          updatedAt: Date.now()
        });
      }
      toast.success(newPinned ? (isAr ? 'تم تثبيت الصفحة بالقمة 📌' : 'Page pinned') : (isAr ? 'تم فك تثبيت الصفحة' : 'Page unpinned'));
    } catch (err: any) {
      toast.error(err.message || 'Error updating pin state');
    }
  };

  // Reorder Pages (Up / Down)
  const handleMoveOrder = async (page: BrowserPageItem, direction: 'up' | 'down', e: React.MouseEvent) => {
    e.stopPropagation();
    const currentIndex = filteredPages.findIndex(p => p.id === page.id);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= filteredPages.length) return;

    const otherPage = filteredPages[targetIndex];

    try {
      const currentSort = page.sortOrder || currentIndex;
      const otherSort = otherPage.sortOrder || targetIndex;

      // Swap sortOrders
      if (!page.id.startsWith('auto_')) {
        await updateDoc(doc(db, 'browser_pages', page.id), { sortOrder: otherSort });
      }
      if (!otherPage.id.startsWith('auto_')) {
        await updateDoc(doc(db, 'browser_pages', otherPage.id), { sortOrder: currentSort });
      }
    } catch (err: any) {
      console.error('Error reordering pages:', err);
    }
  };

  // Delete Page
  const handleDeletePage = async (page: BrowserPageItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(isAr ? `هل أنت متأكد من حذف الصفحة "${page.name}"؟` : `Delete page "${page.name}"?`)) return;

    try {
      if (!page.id.startsWith('auto_')) {
        await deleteDoc(doc(db, 'browser_pages', page.id));
      }
      toast.success(isAr ? 'تم حذف الصفحة' : 'Page deleted');
      if (activePage?.id === page.id) {
        setActivePage(null);
      }
    } catch (err: any) {
      toast.error(err.message || 'Error deleting page');
    }
  };

  // Copy Login Details
  const handleCopyText = (text: string, type: 'user' | 'pass') => {
    if (!text) return;
    let val = text;
    if (type === 'pass') {
      try {
        val = atob(text);
      } catch (_) { }
    }
    navigator.clipboard.writeText(val);
    setCopiedField(type);
    toast.success(type === 'user' ? (isAr ? 'تم نسخ اسم المستخدم!' : 'Username copied!') : (isAr ? 'تم نسخ كلمة السر!' : 'Password copied!'));
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Get effective viewer URL
  const getViewerUrl = (page: BrowserPageItem) => {
    if (!page.url) return 'about:blank';
    if (page.viewMode === 'iframe') {
      return page.url;
    } else {
      // Proxy mode
      return `/api/browser-proxy?url=${encodeURIComponent(page.url)}`;
    }
  };

  const decodedPassword = activePage?.password ? (() => {
    try { return atob(activePage.password); } catch (_) { return activePage.password; }
  })() : '';

  return (
    <div className="flex h-[calc(100vh-5rem)] bg-[#070709] text-slate-200 overflow-hidden font-sans select-none" dir={isAr ? 'rtl' : 'ltr'}>
      
      {/* ── LEFT SIDEBAR: Saved Pages Tabs list ────────────────────────────────────────── */}
      <aside className={`bg-[#0a0a0d] border-r border-[#d4af37]/15 flex flex-col shrink-0 transition-all duration-300 relative z-20 ${isSidebarCollapsed ? 'w-16' : 'w-80'}`}>
        
        {/* Sidebar Header */}
        <div className="p-4 border-b border-white/[0.06] flex items-center justify-between gap-2">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#d4af37]/20 to-amber-900/30 border border-[#d4af37]/40 flex items-center justify-center text-[#d4af37] shrink-0 shadow-md">
                <Globe className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-black text-white tracking-tight truncate">
                  {isAr ? 'متصفح المواقع والمتاجر' : 'Embedded Web Viewer'}
                </h2>
                <span className="text-[10px] text-slate-500 font-bold block truncate">
                  {allDisplayPages.length} {isAr ? 'صفحة مسجلة بالنظام' : 'saved pages'}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-1">
            {!isSidebarCollapsed && (
              <button
                onClick={handleOpenAdd}
                className="px-3 py-1.5 bg-gradient-to-r from-[#d4af37] to-amber-600 hover:from-amber-400 hover:to-[#d4af37] text-black rounded-xl text-xs font-black shadow-md shadow-amber-950/30 transition-all cursor-pointer flex items-center gap-1 shrink-0 active:scale-95"
                title={isAr ? 'إضافة صفحة جديدة' : 'Add New Page'}
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">{isAr ? 'صفحة جديدة' : 'New'}</span>
              </button>
            )}

            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/[0.05] transition-all cursor-pointer"
              title={isSidebarCollapsed ? (isAr ? 'توسيع القائمة' : 'Expand Sidebar') : (isAr ? 'طَي القائمة' : 'Collapse Sidebar')}
            >
              <Layers className="w-4 h-4 text-[#d4af37]" />
            </button>
          </div>
        </div>

        {!isSidebarCollapsed && (
          <>
            {/* Search Input */}
            <div className="p-3 border-b border-white/[0.04]">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute top-1/2 -translate-y-1/2 right-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder={isAr ? 'بحث في صفحات المواقع...' : 'Search web pages...'}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-black/60 border border-white/[0.08] rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-[#d4af37]/60 outline-none"
                />
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto custom-scrollbar pb-1">
                {[
                  { id: 'all', label: isAr ? 'الكل' : 'All' },
                  { id: 'custom', label: isAr ? 'مخصصة' : 'Custom' },
                  { id: 'sources', label: isAr ? 'المتاجر' : 'Stores' },
                  { id: 'shipping', label: isAr ? 'شركات الشحن' : 'Shipping' },
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id as any)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                      activeCategory === cat.id
                        ? 'bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/40'
                        : 'bg-black/40 text-slate-400 hover:text-white border border-white/[0.03]'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Pages List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
              {loading ? (
                <div className="py-12 text-center text-slate-500 text-xs font-bold animate-pulse">
                  {isAr ? 'جاري تحميل قائمة الصفحات...' : 'Loading pages...'}
                </div>
              ) : filteredPages.length === 0 ? (
                <div className="py-12 px-4 text-center text-slate-500 space-y-2">
                  <Globe className="w-8 h-8 mx-auto text-slate-600" />
                  <p className="text-xs font-bold text-slate-400">{isAr ? 'لا توجد صفحات مسجلة حالياً' : 'No pages found'}</p>
                  <button
                    onClick={handleOpenAdd}
                    className="text-[11px] text-[#d4af37] hover:underline font-bold cursor-pointer"
                  >
                    {isAr ? '+ اضف صفحتك الأولى الآن' : '+ Add first page'}
                  </button>
                </div>
              ) : (
                filteredPages.map((page, idx) => {
                  const isActive = activePage?.id === page.id;
                  const isAuto = page.id.startsWith('auto_');
                  return (
                    <div
                      key={page.id}
                      onClick={() => setActivePage(page)}
                      style={{ borderRightColor: page.tabColor || '#d4af37' }}
                      className={`group relative p-2.5 rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-between gap-2 border-r-4 ${
                        isActive
                          ? 'bg-gradient-to-r from-[#d4af37]/20 via-[#d4af37]/10 to-transparent text-white border-y border-l border-white/[0.08] shadow-lg shadow-black/40'
                          : 'bg-black/30 hover:bg-white/[0.03] text-slate-300 border border-white/[0.02]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {/* Custom Color Dot / Favicon */}
                        <div
                          className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm border border-white/20"
                          style={{ backgroundColor: page.tabColor || '#d4af37' }}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-bold truncate ${isActive ? 'text-white font-extrabold' : 'text-slate-200'}`}>
                              {page.name}
                            </span>
                            {page.isPinned && (
                              <Pin className="w-3 h-3 text-[#d4af37] shrink-0 fill-[#d4af37]" />
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[9px] text-slate-500 font-mono truncate max-w-[130px] block">
                              {page.url.replace(/^https?:\/\//, '')}
                            </span>
                            <span className={`px-1 py-0.2 rounded text-[8px] font-black uppercase tracking-tighter ${
                              page.viewMode === 'proxy' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                            }`}>
                              {page.viewMode || 'proxy'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Hover Action Buttons */}
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleTogglePin(page, e)}
                          className={`p-1 rounded-lg hover:bg-white/10 transition-colors ${page.isPinned ? 'text-[#d4af37]' : 'text-slate-500 hover:text-white'}`}
                          title={page.isPinned ? (isAr ? 'إلغاء التثبيت' : 'Unpin') : (isAr ? 'تثبيت بالقمة' : 'Pin to top')}
                        >
                          <Pin className="w-3 h-3" />
                        </button>

                        {!isAuto && (
                          <>
                            <button
                              onClick={(e) => handleOpenEdit(page, e)}
                              className="p-1 text-slate-400 hover:text-[#d4af37] rounded-lg hover:bg-white/10 transition-colors"
                              title={isAr ? 'تعديل البيانات' : 'Edit'}
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => handleDeletePage(page, e)}
                              className="p-1 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-950/30 transition-colors"
                              title={isAr ? 'حذف الصفحة' : 'Delete'}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* Collapsed view icon list */}
        {isSidebarCollapsed && (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2 flex flex-col items-center">
            {filteredPages.map(page => (
              <button
                key={page.id}
                onClick={() => setActivePage(page)}
                style={{ borderColor: page.tabColor || '#d4af37' }}
                className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all cursor-pointer ${
                  activePage?.id === page.id ? 'bg-[#d4af37]/20 scale-110 shadow-lg' : 'bg-black/40 hover:bg-white/10'
                }`}
                title={`${page.name} (${page.url})`}
              >
                <Globe className="w-5 h-5 text-white" />
              </button>
            ))}
          </div>
        )}
      </aside>

      {/* ── RIGHT MAIN CONTENT: Browser Viewer & Toolbar ──────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#040406] relative">
        {activePage ? (
          <>
            {/* Top Address & Navigation Controls Bar */}
            <div className="bg-[#0a0a0d] border-b border-white/[0.08] p-2.5 flex flex-wrap items-center justify-between gap-2.5 shrink-0 shadow-md">
              
              {/* Navigation Buttons + Address Bar Form */}
              <div className="flex items-center gap-2 flex-1 min-w-[320px]">
                
                {/* Back Button */}
                <button
                  onClick={handleGoBack}
                  className="p-2 bg-black/60 border border-white/[0.08] hover:border-[#d4af37]/40 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer shrink-0 active:scale-95"
                  title={isAr ? 'الرجوع خطوة للخلف' : 'Back'}
                >
                  <ArrowRight className="w-4 h-4 text-[#d4af37]" />
                </button>

                {/* Forward Button */}
                <button
                  onClick={handleGoForward}
                  className="p-2 bg-black/60 border border-white/[0.08] hover:border-[#d4af37]/40 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer shrink-0 active:scale-95"
                  title={isAr ? 'التقدم خطوة للأمام' : 'Forward'}
                >
                  <ArrowLeft className="w-4 h-4 text-[#d4af37]" />
                </button>

                {/* Reload Button */}
                <button
                  onClick={() => setIframeKey(k => k + 1)}
                  className="p-2 bg-black/60 border border-white/[0.08] hover:border-[#d4af37]/40 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer shrink-0 active:scale-95"
                  title={isAr ? 'إعادة تحميل الصفحة' : 'Reload'}
                >
                  <RotateCw className="w-4 h-4 text-emerald-400" />
                </button>

                {/* Reset to Home Button */}
                <button
                  onClick={handleResetHome}
                  className="p-2 bg-black/60 border border-white/[0.08] hover:border-[#d4af37]/40 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer shrink-0 active:scale-95"
                  title={isAr ? 'العودة لرابط الصفحة الرئيسي' : 'Reset Home URL'}
                >
                  <Home className="w-4 h-4 text-amber-400" />
                </button>

                {/* Page Tab Color Indicator */}
                <div
                  className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/20 shadow-sm"
                  style={{ backgroundColor: activePage.tabColor || '#d4af37' }}
                  title={activePage.name}
                />

                {/* URL Address Input Form */}
                <form onSubmit={handleNavigateUrl} className="flex-1 flex items-center bg-black/90 border border-white/[0.12] focus-within:border-[#d4af37]/70 rounded-xl px-3 py-1.5 gap-2 min-w-0 shadow-inner">
                  <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <input
                    type="text"
                    value={currentUrlInput}
                    onChange={e => setCurrentUrlInput(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-transparent text-xs text-slate-200 font-mono outline-none truncate"
                    dir="ltr"
                  />
                  <button
                    type="submit"
                    className="px-2 py-0.5 bg-[#d4af37]/20 hover:bg-[#d4af37] text-[#d4af37] hover:text-black rounded text-[10px] font-black uppercase transition-all cursor-pointer shrink-0"
                  >
                    {isAr ? 'انتقال' : 'Go'}
                  </button>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shrink-0 hidden sm:inline-block ${
                    activePage.viewMode === 'proxy' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  }`}>
                    {activePage.viewMode === 'proxy' ? '🔀 PROXY' : '🔲 DIRECT'}
                  </span>
                </form>

                {/* Popout Window Button */}
                <button
                  onClick={() => {
                    if (activePage) {
                      window.open(activePage.url, `SwiftShipBrowser_${activePage.id}`, 'width=1280,height=800,menubar=no,toolbar=no,location=yes');
                    }
                  }}
                  className="p-2 bg-gradient-to-r from-amber-500/20 to-yellow-600/20 border border-amber-500/30 hover:border-amber-400 text-amber-300 rounded-xl transition-all cursor-pointer shrink-0 active:scale-95 flex items-center gap-1 text-[10px] font-black"
                  title={isAr ? 'فتح في شباك مستقل منبثق' : 'Open Popout Window'}
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">{isAr ? 'شباك منبثق' : 'Popout'}</span>
                </button>

                {/* External Link button */}
                <a
                  href={activePage.url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 bg-black/60 border border-white/[0.08] hover:border-[#d4af37]/40 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer shrink-0 active:scale-95"
                  title={isAr ? 'فتح الموقع في تبويب متصفح خارجي' : 'Open in New Tab'}
                >
                  <ExternalLink className="w-4 h-4 text-cyan-400" />
                </a>
              </div>

              {/* Login Credentials Quick-Copy Bar (Password Hidden from Bar) */}
              {activePage.username && (
                <div className="flex items-center gap-2 bg-black/80 border border-[#d4af37]/30 px-3 py-1 rounded-xl shrink-0">
                  <div className="flex items-center gap-1 text-[10px] font-black text-[#d4af37]">
                    <User className="w-3.5 h-3.5" />
                    <span>{isAr ? 'حساب الدخول:' : 'Account:'}</span>
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                    <span className="text-xs text-white font-mono font-bold">{activePage.username}</span>
                    <button
                      onClick={() => handleCopyText(activePage.username!, 'user')}
                      className="text-slate-400 hover:text-[#d4af37] p-0.5 cursor-pointer"
                      title={isAr ? 'نسخ اسم المستخدم' : 'Copy Username'}
                    >
                      {copiedField === 'user' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* iFrame Browser Area */}
            <div className="flex-1 relative w-full h-full overflow-hidden bg-white">
              <iframe
                ref={iframeRef}
                key={iframeKey}
                src={getViewerUrl(activePage)}
                className="w-full h-full border-0"
                title={activePage.name}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; camera; microphone"
                sandbox="allow-forms allow-modals allow-orientation-lock allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-top-navigation allow-downloads"
              />
            </div>
          </>
        ) : (
          /* Empty Selection View */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#d4af37]/10 via-amber-900/10 to-slate-900 border border-[#d4af37]/30 flex items-center justify-center text-[#d4af37] shadow-2xl">
              <Monitor className="w-10 h-10" />
            </div>
            <div className="max-w-md space-y-1">
              <h3 className="text-lg font-black text-white">{isAr ? 'اختر صفحة موقع لعرضها' : 'Select a Web Page to View'}</h3>
              <p className="text-xs text-slate-400">
                {isAr
                  ? 'يمكنك التصفح المباشر، إدارة بيانات الدخول للأنظمة، وتثبيت وتعديل مفضلتك بسهولة'
                  : 'Browse directly, manage login credentials, and pin your favorite portals'
                }
              </p>
            </div>
            <button
              onClick={handleOpenAdd}
              className="px-6 py-2.5 bg-gradient-to-r from-[#d4af37] to-amber-600 hover:from-amber-400 hover:to-[#d4af37] text-black font-black text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {isAr ? 'إضافة صفحة جديدة الآن' : 'Add New Page'}
            </button>
          </div>
        )}
      </main>

      {/* ── MODAL: Add / Edit Page ────────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleSubmit}
            className="bg-gradient-to-b from-[#121215] to-[#08080a] border border-[#d4af37]/30 rounded-3xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden font-sans animate-fade-in"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-white/[0.08] flex justify-between items-center bg-black/40 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-center text-[#d4af37]">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-white text-sm">
                    {editingPage ? (isAr ? 'تعديل بيانات الصفحة' : 'Edit Page') : (isAr ? 'إضافة صفحة موقع جديدة' : 'Add New Web Page')}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold">
                    {isAr ? 'تخزين بيانات الرابط، التبويب، ومعلومات الدخول' : 'Configure URL, credentials, and viewing mode'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/[0.05] cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-start">
              
              {/* Page Name */}
              <div>
                <label className="block text-[11px] font-black text-slate-300 mb-1.5">
                  {isAr ? 'اسم الصفحة / الموقع *' : 'Page Name *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={isAr ? 'مثال: متجر علي بابا، تتبع البريد، لوحة التحكم' : 'e.g. Alibaba Store, DHL Tracking'}
                  className="w-full bg-black/60 border border-white/[0.1] rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-[#d4af37]/60 outline-none"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              {/* URL */}
              <div>
                <label className="block text-[11px] font-black text-slate-300 mb-1.5">
                  {isAr ? 'رابط الموقع (URL) *' : 'Website URL *'}
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://example.com"
                  className="w-full bg-black/60 border border-white/[0.1] rounded-xl px-4 py-2.5 text-xs text-white font-mono placeholder:text-slate-500 focus:border-[#d4af37]/60 outline-none"
                  dir="ltr"
                  value={formData.url}
                  onChange={e => setFormData({ ...formData, url: e.target.value })}
                />
              </div>

              {/* View Mode Choice (iFrame vs Proxy) */}
              <div>
                <label className="block text-[11px] font-black text-slate-300 mb-1.5">
                  {isAr ? 'طريقة العرض والتضمين' : 'Viewing Mode'}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, viewMode: 'proxy' })}
                    className={`p-3 rounded-xl border text-start flex flex-col gap-1 transition-all cursor-pointer ${
                      formData.viewMode === 'proxy'
                        ? 'bg-cyan-500/10 border-cyan-500 text-cyan-300 shadow-md'
                        : 'bg-black/40 border-white/[0.08] text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs">🔀 Proxy خادمي</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-bold">موصى به</span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {isAr ? 'يتجوز حماية X-Frame-Options ويضمن التضمين للمواقع المعقدة' : 'Bypasses X-Frame-Options headers'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, viewMode: 'iframe' })}
                    className={`p-3 rounded-xl border text-start flex flex-col gap-1 transition-all cursor-pointer ${
                      formData.viewMode === 'iframe'
                        ? 'bg-purple-500/10 border-purple-500 text-purple-300 shadow-md'
                        : 'bg-black/40 border-white/[0.08] text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs">🔲 iFrame مباشر</span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {isAr ? 'تضمين مباشر سريع للمواقع التي تتيح العرض' : 'Direct iframe for open websites'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Login Credentials Section */}
              <div className="bg-black/40 border border-white/[0.06] p-4 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-black text-[#d4af37]">
                  <Key className="w-4 h-4" />
                  <span>{isAr ? 'بيانات الدخول للموقع (تُخزن بأمان بالنظام)' : 'Login Credentials'}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">
                      {isAr ? 'اسم المستخدم / البريد' : 'Username / Email'}
                    </label>
                    <input
                      type="text"
                      placeholder="admin@example.com"
                      className="w-full bg-black/60 border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-white font-mono outline-none"
                      value={formData.username}
                      onChange={e => setFormData({ ...formData, username: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">
                      {isAr ? 'كلمة السر' : 'Password'}
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      className="w-full bg-black/60 border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-white font-mono outline-none"
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Tab Color Selector */}
              <div>
                <label className="block text-[11px] font-black text-slate-300 mb-1.5">
                  {isAr ? 'لون التبويب المخصص' : 'Tab Theme Color'}
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {DEFAULT_TAB_COLORS.map(col => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setFormData({ ...formData, tabColor: col })}
                      style={{ backgroundColor: col }}
                      className={`w-7 h-7 rounded-full transition-transform cursor-pointer shadow-md ${
                        formData.tabColor === col ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-black' : 'hover:scale-110'
                      }`}
                    />
                  ))}
                  <input
                    type="color"
                    value={formData.tabColor}
                    onChange={e => setFormData({ ...formData, tabColor: e.target.value })}
                    className="w-8 h-8 rounded-lg border-0 bg-transparent cursor-pointer"
                  />
                </div>
              </div>

              {/* Pin Option */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isPinned"
                  checked={formData.isPinned}
                  onChange={e => setFormData({ ...formData, isPinned: e.target.checked })}
                  className="w-4 h-4 rounded text-[#d4af37] bg-black border-slate-700"
                />
                <label htmlFor="isPinned" className="text-xs font-bold text-slate-300 cursor-pointer">
                  {isAr ? 'تثبيت هذه الصفحة في مقدمة القائمة 📌' : 'Pin page to top'}
                </label>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-white/[0.08] bg-black/40 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-gradient-to-r from-[#d4af37] to-amber-600 hover:from-amber-400 text-black font-black text-xs rounded-xl shadow-md cursor-pointer disabled:opacity-50"
              >
                {submitting ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (editingPage ? (isAr ? 'تحديث البيانات' : 'Update Page') : (isAr ? 'حفظ الصفحة' : 'Save Page'))}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
