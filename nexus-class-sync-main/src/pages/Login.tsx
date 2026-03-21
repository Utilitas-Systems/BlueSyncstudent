import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { APP_VERSION } from "@/lib/appVersion";
import { openUrl } from "@tauri-apps/plugin-opener";

const openExternalUrl = (url: string) => {
  openUrl(url).catch(() => {
    window.open(url, "_blank", "noopener,noreferrer");
  });
};

const Login = () => {
  const [username, setUsername] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [password, setPassword] = useState("");
  const [saveCredentials, setSaveCredentials] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Load saved credentials on component mount
  useEffect(() => {
    const savedCredentials = localStorage.getItem('nexus_student_credentials');
    if (savedCredentials) {
      const { username: savedUsername, schoolCode: savedSchoolCode, password: savedPassword } = JSON.parse(savedCredentials);
      setUsername(savedUsername || "");
      setSchoolCode(savedSchoolCode || "");
      setPassword(savedPassword || "");
      setSaveCredentials(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Save credentials if checkbox is checked
      if (saveCredentials) {
        localStorage.setItem('nexus_student_credentials', JSON.stringify({
          username: username.toUpperCase(),
          schoolCode: schoolCode.toUpperCase(),
          password: password
        }));
      } else {
        localStorage.removeItem('nexus_student_credentials');
      }

      // Use the secure authentication function that handles hashed passwords
      const { data: authResult, error: authError } = await supabase
        .rpc('authenticate_school_user_secure' as any, {
          p_school_code: schoolCode.toUpperCase(),
          p_username: username.toUpperCase(),
          p_password: password,
          p_user_type: 'student'
        });

      if (authError || !authResult || (Array.isArray(authResult) && authResult.length === 0)) {
        toast({
          title: "Login Failed",
          description: "Invalid credentials or school code.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const user = Array.isArray(authResult) ? authResult[0] : authResult;

      // Get school information using the secure function
      const { data: schoolResult, error: schoolError } = await supabase
        .rpc('get_school_by_code' as any, {
          p_school_code: schoolCode.toUpperCase()
        });

      if (schoolError || !schoolResult || (Array.isArray(schoolResult) && schoolResult.length === 0)) {
        toast({
          title: "Login Failed", 
          description: "School not found or inactive.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const school = Array.isArray(schoolResult) ? schoolResult[0] : schoolResult;

      // Log the login
      await supabase.from('login_logs').insert({
        user_id: user.user_id,
        username: user.username,
        login_type: 'student',
        school_id: user.school_id,
        ip_address: 'demo'
      });

      // Ensure student record exists (starts as offline - will be set online by Dashboard)
      const { error: ensureError } = await supabase.rpc('ensure_student_record', {
        p_user_id: user.user_id,
        p_username: user.username,
        p_full_name: user.full_name,
        p_school_id: user.school_id
      });

      if (ensureError) {
        console.error('Error ensuring student record:', ensureError);
      }

      // Explicitly set student as offline until they reach the Dashboard
      await supabase
        .from('students')
        .update({ is_online: false, last_seen: new Date().toISOString() })
        .eq('id', user.user_id);

      // Set the current user session for RLS policies
      const { error: setUserError } = await supabase.rpc('set_current_user' as any, {
        user_uuid: user.user_id
      });

      if (setUserError) {
        console.error('Error setting current user:', setUserError);
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

      toast({
        title: "Welcome!",
        description: `Logged in successfully to ${school.school_name}`,
      });

      navigate('/dashboard');
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      <p
        className="fixed bottom-4 left-4 z-10 text-xs text-muted-foreground tabular-nums select-none"
        aria-label={`App version ${APP_VERSION}`}
      >
        v{APP_VERSION}
      </p>
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
              BlueSync
            </h1>
            <p className="text-nexus-accent font-medium">
              For students
            </p>
          </div>
        </div>

        {/* Login Form */}
        <Card className="nexus-card">
          <CardHeader className="text-center">
            <CardTitle className="text-xl text-nexus-secondary">Student Portal</CardTitle>
            <CardDescription className="text-muted-foreground">
              Enter your credentials to access the classroom
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

        {/* Footer */}
        <div className="text-center text-sm text-nexus-accent">
          <p>Live Bluetooth tracking</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
