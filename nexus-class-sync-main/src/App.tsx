import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState, useEffect } from "react";
import { beaconStudentOffline, updateStudentStatus } from "@/lib/studentRpc";
import { getCurrentWindow } from "@tauri-apps/api/window";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ManageClasses from "./pages/ManageClasses";
import Settings from "./pages/Settings";
import ClassDetails from "./pages/ClassDetails";
import NotFound from "./pages/NotFound";
import { AudioProvider } from "@/contexts/AudioContext";
import { APP_DISPLAY_NAME } from "@/lib/appVersion";
import { UpdateOverlay } from "@/components/UpdateOverlay";

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
        await updateStudentStatus(false);
      } catch {
        beaconStudentOffline();
      }
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
        beaconStudentOffline();
      };
      window.addEventListener('beforeunload', onBeforeUnload);
      return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }
  }, []);

  useEffect(() => {
    const checkClassId = () => {
      const savedClassId = sessionStorage.getItem('current_class_id');
      const savedClass = sessionStorage.getItem('student_class');
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
      
      // Audio/device broadcasting must stay bound to the same class UUID the dashboard/teacher uses.
      // Prefer explicit current_class_id; fall back to persisted student_class.id.
      if (savedClassId) {
        setClassId(savedClassId);
      } else if (savedClass) {
        try {
          const c = JSON.parse(savedClass) as { id?: string };
          setClassId(c?.id || null);
        } catch {
          setClassId(null);
        }
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
        <UpdateOverlay />
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
