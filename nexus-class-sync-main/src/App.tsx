import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner, toast } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { getCurrentWindow } from "@tauri-apps/api/window";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ManageClasses from "./pages/ManageClasses";
import Settings from "./pages/Settings";
import ClassDetails from "./pages/ClassDetails";
import NotFound from "./pages/NotFound";
import { AudioProvider } from "@/contexts/AudioContext";
import { APP_DISPLAY_NAME, UPDATE_FAILED_WEBSITE_MESSAGE } from "@/lib/appVersion";

const queryClient = new QueryClient();

const App = () => {
  const [studentId, setStudentId] = useState<string | null>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);

  useEffect(() => {
    const isTauri = typeof (window as any).__TAURI_INTERNALS__ !== "undefined";
    if (!isTauri) return;
    document.title = APP_DISPLAY_NAME;
    void getCurrentWindow().setTitle(APP_DISPLAY_NAME);
  }, []);

  useEffect(() => {
    const setStudentOffline = async () => {
      try {
        const raw = sessionStorage.getItem('student_user');
        if (!raw) return;
        const user = JSON.parse(raw) as { id?: string };
        if (!user?.id) return;
        await supabase
          .from('students')
          .update({ is_online: false, last_seen: new Date().toISOString() })
          .eq('id', user.id);
      } catch {}
    };

    const isTauri = typeof (window as any).__TAURI_INTERNALS__ !== 'undefined';
    if (isTauri) {
      let unlisten: (() => void) | null = null;
      getCurrentWindow().onCloseRequested(async (event) => {
        event.preventDefault();
        await setStudentOffline();
        getCurrentWindow().destroy();
      }).then((fn) => { unlisten = fn; });
      return () => { unlisten?.(); };
    } else {
      const onBeforeUnload = () => {
        const raw = sessionStorage.getItem('student_user');
        if (!raw) return;
        try {
          const user = JSON.parse(raw) as { id?: string };
          if (!user?.id) return;
          const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/students?id=eq.${user.id}`;
          fetch(url, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              'Prefer': 'return=minimal',
              'x-app-user-id': user.id,
            },
            body: JSON.stringify({ is_online: false, last_seen: new Date().toISOString() }),
            keepalive: true,
          }).catch(() => {});
        } catch {}
      };
      window.addEventListener('beforeunload', onBeforeUnload);
      return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }
  }, []);

  useEffect(() => {
    const isTauri = typeof (window as any).__TAURI_INTERNALS__ !== 'undefined';
    if (!isTauri) return;

    let cancelled = false;
    let busy = false;

    /** Auto-download and install when a newer signed release is published (no prompt). */
    const checkAndApplyUpdate = async () => {
      if (busy || cancelled) return;

      let pendingUpdate: Update | null = null;
      try {
        pendingUpdate = await check();
      } catch {
        // No latest.json, unsigned CI builds, offline, etc. — do not notify.
        return;
      }

      if (!pendingUpdate || cancelled) return;

      busy = true;
      let loadingId: string | number | undefined;
      try {
        loadingId = toast.loading(`Updating ${APP_DISPLAY_NAME} to v${pendingUpdate.version}…`);
        await pendingUpdate.downloadAndInstall();
        if (cancelled) return;
        if (loadingId !== undefined) toast.dismiss(loadingId);
        loadingId = undefined;
        toast.success(`Update installed (v${pendingUpdate.version}). Restart the app to finish.`, {
          duration: 12_000,
        });
      } catch (error) {
        console.error("Auto-update install failed:", error);
        if (loadingId !== undefined) toast.dismiss(loadingId);
        toast.error(UPDATE_FAILED_WEBSITE_MESSAGE, { duration: 10_000 });
      } finally {
        try {
          await pendingUpdate.close();
        } catch {
          /* resource may already be dropped after install */
        }
        busy = false;
      }
    };

    const startupMs = 4_000;
    const startupTimer = window.setTimeout(() => {
      void checkAndApplyUpdate();
    }, startupMs);

    const intervalMs = 6 * 60 * 60 * 1000;
    const interval = window.setInterval(() => {
      void checkAndApplyUpdate();
    }, intervalMs);

    return () => {
      cancelled = true;
      window.clearTimeout(startupTimer);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const checkClassId = () => {
      const savedClassId = sessionStorage.getItem('current_class_id');
      const savedUser = sessionStorage.getItem('student_user');
      
      if (savedUser) {
        try {
          const user = JSON.parse(savedUser);
          setStudentId(user.id);
        } catch (e) {
          setStudentId(null);
        }
      } else {
        setStudentId(null);
      }
      
      if (savedClassId) {
        setClassId(savedClassId);
      } else {
        setClassId(null);
      }
    };

    checkClassId();
    const interval = setInterval(checkClassId, 1000);
    const handleStorageChange = () => { checkClassId(); };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AudioProvider
          studentId={studentId}
          classId={classId}
          enabled={audioEnabled && !!studentId}
        >
          <BrowserRouter>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/manage-classes" element={<ManageClasses />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/class/:classId" element={<ClassDetails />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </BrowserRouter>
        </AudioProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
