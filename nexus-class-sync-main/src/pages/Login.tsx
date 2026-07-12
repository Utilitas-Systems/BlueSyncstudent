import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { loginStudent, storeLoginCreds } from "@/lib/studentLogin";
import { persistStudentClass } from "@/lib/studentClass";
import { formatRpcError } from "@/lib/rpcError";
import { setSessionToken } from "@/lib/studentSession";
import {
  APP_DISPLAY_NAME,
  APP_VERSION,
  APP_VERSION_LABEL,
  formatUpdateError,
} from "@/lib/appVersion";
import { openUrl } from "@tauri-apps/plugin-opener";
import { check } from "@tauri-apps/plugin-updater";
import { isAndroid, usesDesktopUpdater } from "@/lib/platform";
import { installUpdateWithOverlay } from "@/tauri/update-flow";

/** Managed Play listing — replace when the public package ID is live. */
const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.monere.studentportal";

const openExternalUrl = (url: string) => {
  openUrl(url).catch(() => {
    window.open(url, "_blank", "noopener,noreferrer");
  });
};

const MANUAL_UPDATE_COOLDOWN_MS = 30_000;

const Login = () => {
  const [username, setUsername] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [password, setPassword] = useState("");
  const [saveCredentials, setSaveCredentials] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const lastManualUpdateAtRef = useRef(0);
  const navigate = useNavigate();
  const { toast } = useToast();

  const showDesktopUpdater = usesDesktopUpdater();
  const onAndroid = isAndroid();

  // Load saved credentials on component mount
  useEffect(() => {
    const savedCredentials = localStorage.getItem('nexus_student_credentials');
    if (savedCredentials) {
      const { username: savedUsername, schoolCode: savedClassCode, password: savedPassword } = JSON.parse(savedCredentials);
      setUsername(savedUsername || "");
      setSchoolCode(savedClassCode || "");
      setPassword(savedPassword || "");
      setSaveCredentials(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Save credentials if checkbox is checked
      const enteredCode = schoolCode.toUpperCase();

      if (saveCredentials) {
        localStorage.setItem('nexus_student_credentials', JSON.stringify({
          username: username.toUpperCase(),
          schoolCode: enteredCode,
          password: password
        }));
      } else {
        localStorage.removeItem('nexus_student_credentials');
      }

      const login = await loginStudent({
        classCode: enteredCode,
        username: username.toUpperCase(),
        password,
      });

      if (login.error || !login.data) {
        toast({
          title: login.requiresPasswordSetup ? "Password required" : "Login Failed",
          description: login.error ?? "Invalid credentials or school code.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const { user, sessionToken, classFromLogin } = login.data;
      setSessionToken(sessionToken);
      storeLoginCreds(user.username, password);

      let school: Record<string, unknown> | null = null;
      const { data: schoolResult, error: schoolError } = await supabase
        .rpc('get_school_by_code' as never, { p_school_code: enteredCode } as never);
      if (!schoolError && schoolResult) {
        school = Array.isArray(schoolResult) ? schoolResult[0] : schoolResult;
      }
      if (!school && user.school_id) {
        school = {
          id: user.school_id,
          school_name: 'Your School',
          school_code: enteredCode,
          is_active: true,
        };
      }
      if (!school) {
        toast({
          title: "Login Failed",
          description: "School not found or inactive.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Ensure student record exists (starts offline until Dashboard sets status via RPC)
      let { error: ensureError } = await supabase.rpc('ensure_student_record' as never, {
        p_user_id: user.user_id,
        p_username: user.username,
        p_full_name: user.full_name,
        p_school_id: user.school_id,
        p_session_token: sessionToken,
      } as never);

      if (ensureError) {
        const fallback = await supabase.rpc('ensure_student_record' as never, {
          p_user_id: user.user_id,
          p_username: user.username,
          p_full_name: user.full_name,
          p_school_id: user.school_id,
        } as never);
        ensureError = fallback.error;
      }

      if (ensureError) {
        console.error('Error ensuring student record:', ensureError);
      }

      // Store user info in session storage
      sessionStorage.setItem('student_user', JSON.stringify({
        id: user.user_id,
        username: user.username,
        full_name: user.full_name,
        school_id: user.school_id,
        user_type: user.user_type
      }));
      sessionStorage.setItem('student_school', JSON.stringify(school));

      if (classFromLogin) {
        persistStudentClass(classFromLogin);
      }

      toast({
        title: "Welcome!",
        description: `Logged in successfully to ${(school as { school_name?: string }).school_name ?? 'your school'}`,
      });

      navigate('/dashboard');
    } catch (error) {
      toast({
        title: "Error",
        description: formatRpcError(error, "An unexpected error occurred."),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualCheckForUpdates = async () => {
    if (!showDesktopUpdater || checkingUpdate) return;
    const now = Date.now();
    if (now - lastManualUpdateAtRef.current < MANUAL_UPDATE_COOLDOWN_MS) {
      sonnerToast.message("Please wait a moment before checking again.");
      return;
    }
    lastManualUpdateAtRef.current = now;
    setCheckingUpdate(true);
    let pending: Awaited<ReturnType<typeof check>> = null;
    try {
      pending = await check();
    } catch (e) {
      console.error("[Login] Update check failed:", e);
      const msg = e instanceof Error ? e.message : "Could not reach the update server.";
      sonnerToast.error("Update check failed", { description: msg, duration: 8000 });
      setCheckingUpdate(false);
      return;
    }

    if (!pending) {
      sonnerToast.success("You’re on the latest version.", { duration: 4000 });
      setCheckingUpdate(false);
      return;
    }

    try {
      const result = await installUpdateWithOverlay(pending);
      if (result === "relaunch-failed") {
        sonnerToast.success(`Update installed (v${pending.version}). Restart the app to finish.`, {
          duration: 12_000,
        });
      }
    } catch (error) {
      console.error("[Login] Update install failed:", error);
      sonnerToast.error("Update failed", {
        description: formatUpdateError(error),
        duration: 12_000,
      });
    } finally {
      try {
        await pending.close();
      } catch {
        /* ignore */
      }
      setCheckingUpdate(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      <div
        className="fixed bottom-4 left-4 z-10 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-muted-foreground tabular-nums select-none max-w-[min(100vw-2rem,20rem)]"
      >
        <span aria-label={`App version ${APP_VERSION}`}>{APP_VERSION_LABEL}</span>
        {showDesktopUpdater ? (
          <button
            type="button"
            onClick={() => void handleManualCheckForUpdates()}
            disabled={checkingUpdate}
            className="p-0 m-0 text-[10px] font-normal text-muted-foreground/35 hover:text-muted-foreground/80 underline-offset-2 hover:underline bg-transparent border-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Check for app updates"
          >
            {checkingUpdate ? "Checking…" : "Update"}
          </button>
        ) : null}
        {onAndroid ? (
          <button
            type="button"
            onClick={() => openExternalUrl(PLAY_STORE_URL)}
            className="p-0 m-0 text-[10px] font-normal text-muted-foreground/35 hover:text-muted-foreground/80 underline-offset-2 hover:underline bg-transparent border-none cursor-pointer"
            aria-label="Open in Play Store"
          >
            Play Store
          </button>
        ) : null}
      </div>
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-24 h-24 flex items-center justify-center">
              <img
                src="/bluesync-student-logo.svg"
                alt="BlueSync for students"
                className="w-20 h-20 object-contain"
              />
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-bold text-nexus-secondary mb-2">
              {APP_DISPLAY_NAME}
            </h1>
          </div>
        </div>

        {/* Login Form */}
        <Card className="nexus-card">
          <CardHeader className="text-center">
            <CardTitle className="text-xl text-nexus-secondary">Sign in</CardTitle>
            <CardDescription className="text-muted-foreground">
              Enter your credentials to sign in
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-foreground">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toUpperCase())}
                  required
                  className="uppercase placeholder:normal-case"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="schoolCode" className="text-foreground">School Code</Label>
                <Input
                  id="schoolCode"
                  type="text"
                  placeholder="Enter school code"
                  value={schoolCode}
                  onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                  required
                  className="uppercase placeholder:normal-case"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="saveCredentials"
                  checked={saveCredentials}
                  onCheckedChange={(checked) => setSaveCredentials(checked as boolean)}
                />
                <Label 
                  htmlFor="saveCredentials" 
                  className="text-sm text-muted-foreground cursor-pointer"
                >
                  Save my credentials (username, password, and school code)
                </Label>
              </div>

              <Button
                type="submit"
                variant="nexus"
                size="lg"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? "Signing In..." : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-3 w-full max-w-md">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full bg-transparent border border-border/50 hover:bg-accent/20 text-sm font-normal"
            onClick={() => openExternalUrl("https://bluesync.education/register")}
          >
            Create account
          </Button>
          <div className="text-center text-xs text-muted-foreground">
            By signing in you accept our{" "}
            <button
              type="button"
              onClick={() => openExternalUrl("https://bluesync.education/privacypolicy")}
              className="text-nexus-primary hover:text-nexus-secondary underline bg-transparent border-none cursor-pointer p-0 font-inherit"
            >
              privacy policy
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Login;
