import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useBroadcastAudio } from "@/hooks/useBroadcastAudio";
import { useBroadcastDevices } from "@/hooks/useBroadcastDevices";
import { useBroadcastPresence } from "@/hooks/useBroadcastPresence";
import { useStudentAttentionListener } from "@/hooks/useStudentAttentionListener";
import { supabase } from "@/integrations/supabase/client";
import nukeSoundUrl from "@/assets/nuke-sound.mp3";
import { invoke } from "@tauri-apps/api/core";
import { Progress } from "@/components/ui/progress";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { 
  Wifi, 
  Shield, 
  Users, 
  Settings, 
  LogOut, 
  Plus,
  Bluetooth,
  Monitor,
  Smartphone,
  Headphones,
  Volume2
} from "lucide-react";

interface StudentUser {
  id: string;
  username: string;
  full_name: string;
  school_id: string;
  is_online?: boolean;
}

interface School {
  id: string;
  school_name: string;
  school_code: string;
}

interface ClassData {
  id: string;
  class_name: string;
  class_code: string;
}

interface BluetoothDevice {
  id: string;
  name: string;
  type: string;
  connected: boolean;
  sharing: boolean;
}

// Extend Navigator interface for TypeScript
declare global {
  interface Navigator {
    bluetooth?: {
      requestDevice(options: any): Promise<any>;
      getDevices(): Promise<any[]>;
    };
  }
}

const Dashboard = () => {
  const [user, setUser] = useState<StudentUser | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [classCode, setClassCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [bluetoothDevices, setBluetoothDevices] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const isShuttingDownRef = useRef(false);
  const reminderRef = useRef<number | null>(null);
  const scanningRef = useRef(false);
  const devicesRef = useRef<any[]>([]);
  const startedPresenceRef = useRef(false);
  const alertAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Unlock alert audio on first user interaction (required for autoplay policy)
  useEffect(() => {
    const unlock = () => {
      if (audioUnlockedRef.current) return;
      audioUnlockedRef.current = true;
      try {
        const audio = new Audio(nukeSoundUrl);
        audio.volume = 1;
        alertAudioRef.current = audio;
        audio.play().then(() => audio.pause()).catch(() => {});
        audio.currentTime = 0;
      } catch {}
    };
    const opts = { capture: true, once: true };
    document.addEventListener('click', unlock, opts);
    document.addEventListener('keydown', unlock, opts);
    document.addEventListener('touchstart', unlock, opts);
    return () => {
      document.removeEventListener('click', unlock, opts);
      document.removeEventListener('keydown', unlock, opts);
      document.removeEventListener('touchstart', unlock, opts);
    };
  }, []);

  // Only call hooks when we have valid user and classData - use empty string fallback but hooks should handle it
  const userId = user?.id || "";
  const classId = classData?.id || "";
  const hasValidData = !!userId && !!classId;

  // Call hooks with valid data (hooks handle empty strings gracefully)
  const presenceResult = useBroadcastPresence({
    student: {
      id: userId,
      username: user?.username || "",
      full_name: user?.full_name || "",
    },
    classId: classId,
  });

  // Extract presence values safely
  let presenceOnline = false;
  let startPresence = () => {};
  let stopPresence = () => {};
  
  if (presenceResult && typeof presenceResult === 'object' && 'isOnline' in presenceResult) {
    presenceOnline = presenceResult.isOnline || false;
    startPresence = presenceResult.startPresence || (() => {});
    stopPresence = presenceResult.stopPresence || (() => {});
  }

  // Real-time broadcast hooks
  // Enable audio monitoring whenever user is logged in (always detect system audio for display)
  const audioResult = useBroadcastAudio({
    studentId: userId,
    classId: classId,
    enabled: !!userId,
  });

  // Extract audio values safely
  let audioLevel = 0;
  let isListening = false;
  
  if (audioResult && typeof audioResult === 'object' && 'audioLevel' in audioResult) {
    audioLevel = audioResult.audioLevel || 0;
    isListening = audioResult.isListening || false;
  } else if (typeof audioResult === 'number') {
    audioLevel = audioResult;
  }

  const devicesResult = useBroadcastDevices({
    studentId: userId,
    classId: classId,
  });

  // Extract device broadcast function safely
  const broadcastDeviceList = (devicesResult && typeof devicesResult === 'object' && 'broadcastDeviceList' in devicesResult) 
    ? (devicesResult.broadcastDeviceList || (() => {}))
    : (() => {});

  const playAlertSound = () => {
    try {
      const vol = (() => {
        const s = localStorage.getItem('chimeVolume');
        return s ? Math.max(0.3, parseFloat(s)) : 0.5;
      })();
      const audio = alertAudioRef.current || new Audio(nukeSoundUrl);
      if (!alertAudioRef.current) alertAudioRef.current = audio;
      audio.volume = vol;
      audio.currentTime = 0;
      audio.play().catch((e) => console.warn('[Dashboard] Alert sound play failed:', e));
    } catch {}
  };

  // Listen for teacher attention alerts (personal and class-wide)
  useStudentAttentionListener({
    classId: classId || null,
    studentId: userId,
    onAttentionAlert: (alert) => {
      playAlertSound();
      toast({
        title: alert.type === 'individual' ? "Teacher needs your attention" : "Teacher needs everyone's attention",
        description: alert.message,
        variant: "default",
      });
    },
  });

  const onlineBadge = (presenceOnline || !!user?.is_online);

  const getConnectedBluetoothDevices = async () => {
    if (isShuttingDownRef.current || scanningRef.current) return;
    scanningRef.current = true;
    setIsScanning(true);
    try {
      const isTauri = typeof (window as any).__TAURI_INTERNALS__ !== 'undefined';
      if (!isTauri) {
        toast({
          title: "Desktop App Required",
          description: "Bluetooth scanning requires the desktop app (Windows or Mac).",
          variant: "destructive",
        });
        return;
      }

      // Prefer detailed device info
      let detailed: Array<{ device_mac_address: string; device_name: string; connection_status: string; signal_strength?: number; }>|null = null;
      try {
        detailed = await invoke('get_current_bluetooth_devices_detailed');
      } catch (_) {
        detailed = null;
      }

      let deviceList: Array<{ id: string; name: string; type: string; isConnected: boolean; sharing: boolean }>;
      if (Array.isArray(detailed) && detailed.length > 0) {
        deviceList = detailed.map((d, idx) => ({
          id: d.device_mac_address || `${d.device_name}-${idx}`,
          name: d.device_name || 'Unknown Device',
          type: 'bluetooth',
          isConnected: (d.connection_status || '').toLowerCase() === 'connected',
          sharing: (d.connection_status || '').toLowerCase() === 'connected',
        }));
      } else {
        deviceList = [];
      }

      // Merge names-only list too
      try {
        const names = await invoke<string[]>('get_current_bluetooth_devices');
        const seen = new Set((deviceList || []).map(d => (d.name || '').toLowerCase()));
        (names || []).forEach((name, idx) => {
          const nm = (name || '').trim();
          if (!nm) return;
          const key = nm.toLowerCase();
          if (!seen.has(key)) {
            deviceList.push({ id: `${nm}-${idx}`, name: nm, type: 'bluetooth', isConnected: true, sharing: true });
            seen.add(key);
          }
        });
      } catch {}

      if (!isShuttingDownRef.current) {
        // stable sort and diff - only update state and broadcast when something actually changed
        deviceList.sort((a, b) => (a.id + a.name).localeCompare(b.id + b.name));
        const changed = !arraysEqual(devicesRef.current, deviceList);
        if (changed) {
          devicesRef.current = deviceList;
          setBluetoothDevices(deviceList);
          try {
            (broadcastDeviceList as any)?.(deviceList.map(d => ({ name: d.name, type: d.type, isConnected: d.isConnected })));
          } catch {}
        }
      }

      // no toast
    } catch (error) {
      console.error('Error getting Bluetooth devices via Tauri:', error);
      toast({
        title: "Scan Error",
        description: "Unable to read Bluetooth devices.",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
      scanningRef.current = false;
    }
  };

  const arraysEqual = (a: any[], b: any[]) => {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      const da = a[i];
      const db = b[i];
      if (!da || !db) return false;
      if (da.id !== db.id || da.name !== db.name || da.type !== db.type || !!da.isConnected !== !!db.isConnected) return false;
    }
    return true;
  };

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoadError(null);
        const storedUser = sessionStorage.getItem('student_user');
        const storedSchool = sessionStorage.getItem('student_school');
        const storedClass = sessionStorage.getItem('student_class');
        
        if (!storedUser || !storedSchool) {
          console.log('[Dashboard] No user or school in session, redirecting to login');
          navigate('/');
          return;
        }

        let parsedUser: StudentUser;
        let parsedSchool: School;
        
        try {
          parsedUser = JSON.parse(storedUser);
          parsedSchool = JSON.parse(storedSchool);
        } catch (parseError) {
          console.error('[Dashboard] Error parsing user/school data', parseError);
          setLoadError('Failed to parse user data. Please log in again.');
          setTimeout(() => navigate('/'), 2000);
          return;
        }
        
        if (!parsedUser?.id || !parsedSchool?.id) {
          console.error('[Dashboard] Invalid user or school data after parsing');
          setLoadError('Invalid user or school data. Please log in again.');
          setTimeout(() => navigate('/'), 2000);
          return;
        }
        
        console.log('[Dashboard] Loading user and school data', { userId: parsedUser.id, schoolId: parsedSchool.id });
        
        setUser(parsedUser);
        setSchool(parsedSchool);
        
        if (storedClass) {
          try { 
            const parsedClass = JSON.parse(storedClass);
            console.log('[Dashboard] Found class in session', parsedClass);
            setClassData(parsedClass); 
          } catch (e) {
            console.error('[Dashboard] Error parsing class data', e);
          }
        }

        // Set the current user session for RLS policies
        try {
          const { error: setUserError } = await supabase.rpc('set_current_user' as any, {
            user_uuid: parsedUser.id
          });

          if (setUserError) {
            console.error('Error setting current user:', setUserError);
          }
        } catch (rpcError) {
          console.error('[Dashboard] Error in set_current_user RPC', rpcError);
        }

        // Fetch current online status from database
        try {
          const { data, error } = await supabase
            .from('students')
            .select('is_online')
            .eq('id', parsedUser.id)
            .maybeSingle();
          
          if (error) {
            setUser(prev => prev ? { ...prev, is_online: false } : null);
          } else if (data) {
            setUser(prev => prev ? { ...prev, is_online: data.is_online } : null);
          }
        } catch (statusError) {
          setUser(prev => prev ? { ...prev, is_online: false } : null);
        }

        // If no class in session, fetch enrolled classes via RPC and use first one
        if (!storedClass) {
          try {
            let rpcResult = await supabase.rpc('get_student_classes' as any, { p_student_id: parsedUser.id });
            if (rpcResult.error && /function.*does not exist|Could not find|no such function/i.test(rpcResult.error.message || "")) {
              rpcResult = await supabase.rpc('get_student_classes' as any);
            }
            let classesList: Array<{ id: string; class_code?: string; class_name?: string }> = [];
            if (!rpcResult.error && Array.isArray(rpcResult.data)) {
              classesList = rpcResult.data;
            } else if (rpcResult.error) {
              const fallback = await supabase
                .from("class_students")
                .select("class_id, classes(id, class_code, class_name, created_at, teacher_id)")
                .eq("student_id", parsedUser.id);
              if (!fallback.error && fallback.data) {
                classesList = (fallback.data as { classes: { id: string; class_code?: string; class_name?: string } | null }[])
                  .filter((r) => r.classes)
                  .map((r) => r.classes!);
              }
            }
            if (classesList.length > 0) {
              const first = classesList[0];
              const cls = { id: first.id, class_code: first.class_code ?? '', class_name: first.class_name ?? 'Class' };
              setClassData(cls as ClassData);
              try { sessionStorage.setItem('student_class', JSON.stringify(cls)); localStorage.setItem('student_class', JSON.stringify(cls)); } catch {}
            }
          } catch (classError) {
            console.error('[Dashboard] Error fetching class data', classError);
          }
        }
      } catch (error) {
        console.error('[Dashboard] Error loading dashboard data', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        setLoadError(`Failed to load dashboard: ${errorMessage}`);
        toast({
          title: "Error",
          description: "Failed to load dashboard data. Please try logging in again.",
          variant: "destructive",
        });
      }
    };

    loadDashboardData();
  }, [navigate, toast]);

  // Ensure online status is set when app opens
  useEffect(() => {
    const setOnline = async () => {
      if (!user?.id) return;
      try {
        const { error } = await supabase
          .from('students')
          .update({ is_online: true, last_seen: new Date().toISOString() })
          .eq('id', user.id);
        if (!error) {
          setUser(prev => prev ? { ...prev, is_online: true } : prev);
        }
      } catch {}
    };
    setOnline();
  }, [user?.id]);

  const setDbOnlineStatus = async (flag: boolean) => {
    if (!user?.id) return;
    try {
      const { error } = await supabase
        .from('students')
        .update({ is_online: flag, last_seen: new Date().toISOString() })
        .eq('id', user.id);
      if (!error) {
        setUser(prev => prev ? { ...prev, is_online: flag } : prev);
      } else {
        console.error('Failed to update is_online:', error);
      }
    } catch (e) {
      console.error('Error updating is_online:', e);
    }
  };

  // Start presence once both user and class are set
  useEffect(() => {
    if (user && classData) {
      if (!startedPresenceRef.current) {
        startedPresenceRef.current = true;
        startPresence();
      }
      return () => {
        stopPresence();
        startedPresenceRef.current = false;
      };
    }
  }, [user, classData, startPresence, stopPresence]);

  // After presence is active, update online status (no automatic Bluetooth scan)
  useEffect(() => {
    if (presenceOnline) {
      setDbOnlineStatus(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presenceOnline]);

  // Periodic Windows notification every 30 minutes while online
  useEffect(() => {
    const notify = async () => {
      try {
        const isTauri = typeof (window as any).__TAURI_INTERNALS__ !== 'undefined';
        if (isTauri) {
          // Use global notification plugin via window.__TAURI__ bridge
          try { await (window as any).__TAURI__?.notification?.send?.({ title: 'BlueSync Student', body: 'your still being monitored' }); }
          catch { /* Notification not available */ }
        }
      } catch {}
    };

    if (presenceOnline) {
      // fire once immediately, then every 30 minutes
      void notify();
      if (reminderRef.current) { window.clearInterval(reminderRef.current); }
      reminderRef.current = window.setInterval(() => { void notify(); }, 30 * 60 * 1000);
    } else {
      if (reminderRef.current) { window.clearInterval(reminderRef.current); reminderRef.current = null; }
    }

    return () => { if (reminderRef.current) { window.clearInterval(reminderRef.current); reminderRef.current = null; } };
  }, [presenceOnline]);

  // Tauri window focus/blur handling to manage presence
  useEffect(() => {
    let unlistenBlur: (() => void) | undefined;
    let unlistenFocus: (() => void) | undefined;

    const setupTauriEvents = async () => {
      try {
        const win = getCurrentWindow();
        unlistenBlur = await win.listen('tauri://window-blur', () => {
          try { stopPresence(); } catch {}
          setDbOnlineStatus(false);
        });
        unlistenFocus = await win.listen('tauri://window-focus', async () => {
          try {
            const online = navigator.onLine;
            if (online) { await startPresence(); setDbOnlineStatus(true); }
          } catch {}
        });
      } catch {}
    };

    setupTauriEvents();
    return () => {
      try { unlistenBlur?.(); } catch {}
      try { unlistenFocus?.(); } catch {}
    };
  }, [startPresence, stopPresence]);

  // Network connectivity monitoring to toggle presence
  useEffect(() => {
    let interval: number | undefined;
    const check = async () => {
      try {
        const online = navigator.onLine;
        if (online && !presenceOnline) {
          await startPresence();
          setDbOnlineStatus(true);
        } else if (!online && presenceOnline) {
          stopPresence();
          setDbOnlineStatus(false);
        }
      } catch {}
    };
    interval = window.setInterval(check, 30000);
    return () => { if (interval) window.clearInterval(interval); };
  }, [presenceOnline, startPresence, stopPresence]);

  // Bluetooth status poll - update when devices connect/disconnect, only broadcast on change
  const getBtRef = useRef(getConnectedBluetoothDevices);
  getBtRef.current = getConnectedBluetoothDevices;
  useEffect(() => {
    if (!presenceOnline || !classData || !hasValidData) return;
    const isTauri = typeof (window as any).__TAURI_INTERNALS__ !== 'undefined';
    if (!isTauri) return;
    const poll = () => { getBtRef.current(); };
    poll(); // initial
    const interval = window.setInterval(poll, 15000);
    return () => window.clearInterval(interval);
  }, [presenceOnline, classData?.id, hasValidData]);

  // Minimize/restore lifecycle events
  useEffect(() => {
    let unlistenMin: (() => void) | undefined;
    let unlistenRest: (() => void) | undefined;
    const setupLifecycle = async () => {
      try {
        const win = getCurrentWindow();
        unlistenMin = await win.listen('tauri://window-minimized', () => {});
        unlistenRest = await win.listen('tauri://window-restored', async () => {
          try {
            const online = navigator.onLine;
            if (online && !presenceOnline) {
              await startPresence();
              setDbOnlineStatus(true);
            }
          } catch {}
        });
      } catch {}
    };
    setupLifecycle();
    return () => { try { unlistenMin?.(); unlistenRest?.(); } catch {} };
  }, [presenceOnline, startPresence]);

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !classCode.trim()) return;

    setIsJoining(true);
    const trimmedCode = classCode.trim().toUpperCase();

    try {
      // 1) Try join_class_by_code RPC (if it exists and uses current_user_id or auth)
      let data: unknown = null;
      let rpcError: { message?: string } | null = null;
      for (const params of [{ p_class_code: trimmedCode }, { class_code: trimmedCode }]) {
        const result = await supabase.rpc('join_class_by_code' as any, params);
        rpcError = result.error;
        data = result.data;
        if (!result.error) break;
        if (result.error?.message?.includes('function') && result.error?.message?.includes('does not exist')) break;
      }

      if (!rpcError && data != null) {
        const classRecord = (data && typeof data === 'object' && 'id' in data)
          ? (data as ClassData)
          : Array.isArray(data) && data[0]
            ? (data[0] as ClassData)
            : null;
        if (classRecord?.id) {
          toast({ title: "Success!", description: `Joined ${classRecord.class_name || 'the class'} successfully.` });
          setClassCode("");
          setClassData(classRecord);
          try { sessionStorage.setItem('student_class', JSON.stringify(classRecord)); localStorage.setItem('student_class', JSON.stringify(classRecord)); } catch {}
          setIsJoining(false);
          return;
        }
      }

      // 2) Fallback: get class via RPC or direct select, then insert into class_students
      let classRecord: ClassData | null = null;

      const { data: classDataFromRpc, error: lookupErr } = await supabase.rpc('student_get_class_by_code' as any, {
        p_class_code: trimmedCode,
        p_student_id: user.id
      });

      if (!lookupErr && classDataFromRpc && typeof classDataFromRpc === 'object' && 'id' in classDataFromRpc) {
        const raw = classDataFromRpc as Record<string, unknown>;
        classRecord = {
          id: raw.id as string,
          class_name: (raw.class_name as string) ?? 'Class',
          class_code: (raw.class_code as string) ?? trimmedCode
        } as ClassData;
      }

      if (!classRecord) {
        const { data: classRow, error: selectErr } = await supabase
          .from('classes')
          .select('id, class_code, class_name')
          .eq('class_code', trimmedCode)
          .eq('school_id', user.school_id)
          .maybeSingle();
        if (!selectErr && classRow) {
          classRecord = classRow as ClassData;
        }
      }

      if (!classRecord?.id) {
        toast({
          title: "Class Not Found",
          description: `No class with code "${trimmedCode}" in your school. Check the code and try again.`,
          variant: "destructive",
        });
        setIsJoining(false);
        return;
      }

      const { data: existing } = await supabase
        .from('class_students')
        .select('class_id')
        .eq('class_id', classRecord.id)
        .eq('student_id', user.id)
        .maybeSingle();

      if (existing) {
        toast({ title: "Already Joined", description: "You're already in this class.", variant: "destructive" });
        setClassCode("");
        setClassData(classRecord);
        try { sessionStorage.setItem('student_class', JSON.stringify(classRecord)); localStorage.setItem('student_class', JSON.stringify(classRecord)); } catch {}
        setIsJoining(false);
        return;
      }

      const { error: insertErr } = await supabase
        .from('class_students')
        .insert({ class_id: classRecord.id, student_id: user.id });

      if (insertErr) {
        toast({
          title: "Could not join class",
          description: insertErr.message || "Please try again.",
          variant: "destructive",
        });
        setIsJoining(false);
        return;
      }

      toast({ title: "Success!", description: `Joined ${classRecord.class_name} successfully.` });
      setClassCode("");
      setClassData(classRecord);
      try { sessionStorage.setItem('student_class', JSON.stringify(classRecord)); localStorage.setItem('student_class', JSON.stringify(classRecord)); } catch {}
    } catch (error) {
      console.error('Join class error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsJoining(false);
    }
  };

  const handleLogout = async () => {
    // Cleanup per transmission guide: send final zero audio, empty devices, untrack presence
    try { broadcastDeviceList([]); } catch {}
    try { stopPresence(); } catch {}
    startedPresenceRef.current = false;
    if (user) {
      console.log('Setting student offline status for user:', user.id);
      const { error } = await supabase
        .from('students')
        .update({ 
          is_online: false, 
          last_seen: new Date().toISOString() 
        })
        .eq('id', user.id);
        
      if (error) {
        console.error('Error setting offline status:', error);
      } else {
        console.log('Successfully set student offline status');
      }
    }
    
    sessionStorage.removeItem('student_user');
    sessionStorage.removeItem('student_school');
    sessionStorage.removeItem('student_class'); localStorage.removeItem('student_class');
    navigate('/');
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case "headphones": return <Headphones className="h-5 w-5" />;
      case "smartphone": return <Smartphone className="h-5 w-5" />;
      case "laptop": return <Monitor className="h-5 w-5" />;
      default: return <Bluetooth className="h-5 w-5" />;
    }
  };

  // Show error state if there was a loading error
  if (loadError) {
    console.error('[Dashboard] Load error:', loadError);
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" style={{ backgroundColor: '#ffffff', color: '#000000' }}>
        <div className="text-center space-y-4 p-8" style={{ backgroundColor: '#ffffff', color: '#000000' }}>
          <p className="text-lg font-semibold" style={{ color: '#dc2626' }}>Error loading dashboard</p>
          <p className="text-sm" style={{ color: '#666666' }}>{loadError}</p>
          <Button onClick={() => navigate('/')} style={{ marginTop: '16px' }}>Return to Login</Button>
        </div>
      </div>
    );
  }

  // Show loading state while data is being loaded
  if (!user || !school) {
    console.log('[Dashboard] Waiting for user/school data', { hasUser: !!user, hasSchool: !!school });
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" style={{ backgroundColor: '#ffffff', color: '#000000' }}>
        <div className="text-center space-y-4 p-8" style={{ backgroundColor: '#ffffff', color: '#000000' }}>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nexus-primary mx-auto" style={{ borderColor: '#3b82f6' }}></div>
          <p className="text-muted-foreground" style={{ color: '#666666', fontSize: '16px' }}>Loading dashboard...</p>
          <p className="text-xs" style={{ color: '#999999' }}>Please wait while we load your data</p>
        </div>
      </div>
    );
  }

  // Safety check - if we somehow get here without valid data, show error
  if (!user.id || !school.id) {
    console.error('[Dashboard] Invalid user or school data', { user, school });
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" style={{ backgroundColor: '#ffffff', color: '#000000' }}>
        <div className="text-center space-y-4 p-8" style={{ backgroundColor: '#ffffff', color: '#000000' }}>
          <p className="text-lg font-semibold" style={{ color: '#dc2626' }}>Error loading dashboard data</p>
          <p className="text-sm" style={{ color: '#666666' }}>Invalid user or school information. Please log in again.</p>
          <Button onClick={() => navigate('/')} style={{ marginTop: '16px' }}>Return to Login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-full bg-nexus-primary/10">
              <Wifi className="h-6 w-6 text-nexus-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-nexus-secondary">BlueSync Student</h1>
              <p className="text-sm text-muted-foreground">{school.school_name}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2" data-audio-level={audioLevel} data-listening={isListening}>
          <Badge variant={onlineBadge ? "default" : "secondary"}>
            {onlineBadge ? "Online" : "Offline"}
          </Badge>
          <Button
            variant="nexus-ghost"
            size="sm"
            onClick={() => navigate('/manage-classes')}
          >
            <Users className="h-4 w-4 mr-2" />
            Manage Classes
          </Button>
          <Button
            variant="nexus-outline"
            size="sm"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      {/* Welcome Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-full bg-nexus-primary/10">
              <Shield className="h-8 w-8 text-nexus-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Welcome, {user.full_name || user.username}</h2>
              <p className="text-muted-foreground">Ready to connect to your classroom</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Join Class Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Plus className="h-5 w-5" />
              <span>Join Class</span>
            </CardTitle>
            <CardDescription>
              Enter the class code provided by your teacher
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoinClass} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="classCode">Class Code</Label>
                <Input
                  id="classCode"
                  type="text"
                  placeholder="CLASS_CODE"
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                  required
                  className="uppercase placeholder:uppercase"
                />
              </div>
              <Button
                type="submit"
                variant="nexus"
                className="w-full"
                disabled={isJoining}
              >
                {isJoining ? "Joining..." : "Join Class"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Quick Actions</span>
            </CardTitle>
            <CardDescription>
              Manage your classroom experience
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="nexus-outline"
              className="w-full justify-start"
              onClick={() => navigate('/manage-classes')}
            >
              <Users className="h-4 w-4 mr-2" />
              Manage Classes
            </Button>
            <Button
              variant="nexus-outline"
              className="w-full justify-start"
              onClick={() => navigate('/settings')}
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
            <Button
              variant="nexus-outline"
              className="w-full justify-start"
              onClick={() => { audioUnlockedRef.current = true; playAlertSound(); toast({ title: "Test Sound", description: "If you heard the chime, notifications will work." }); }}
            >
              <Volume2 className="h-4 w-4 mr-2" />
              Test Notification Sound
            </Button>
            <Button
              variant="nexus-outline"
              className="w-full justify-start"
              onClick={getConnectedBluetoothDevices}
              disabled={isScanning}
            >
              <Bluetooth className="h-4 w-4 mr-2" />
              {isScanning ? "Scanning..." : "Scan Bluetooth Devices"}
            </Button>
          </CardContent>
        </Card>

        {/* System Audio Visualizer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Monitor className="h-5 w-5" />
              <span>System Audio</span>
            </CardTitle>
            <CardDescription>
              Live volume level from your computer
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Progress value={audioLevel} />
              <div className="text-sm text-muted-foreground">{audioLevel}%</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bluetooth Devices Card - Only show when online */}
      {user.is_online && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bluetooth className="h-5 w-5" />
              <span>Your Bluetooth Devices</span>
            </CardTitle>
            <CardDescription>
              Devices available for classroom sharing
            </CardDescription>
          </CardHeader>
          <CardContent>
            {bluetoothDevices.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {bluetoothDevices.map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-full ${device.connected ? 'bg-nexus-success/10 text-nexus-success' : 'bg-muted text-muted-foreground'}`}>
                        {getDeviceIcon(device.type)}
                      </div>
                      <div>
                        <h4 className="font-medium">{device.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {device.isConnected ? 'Connected' : 'Disconnected'}
                          {device.sharing && ' • Sharing'}
                        </p>
                      </div>
                    </div>
                    <div className={`h-3 w-3 rounded-full ${device.isConnected ? 'bg-nexus-success' : 'bg-muted-foreground'}`} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Bluetooth className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No Bluetooth devices found</p>
                <p className="text-sm text-muted-foreground mt-2">Click "Scan Bluetooth Devices" to discover nearby devices</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
