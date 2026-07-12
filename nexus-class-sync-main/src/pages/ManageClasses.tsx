import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { fetchStudentClasses, studentLeaveClass } from "@/lib/studentRpc";
import { getSessionToken } from "@/lib/studentSession";
import {
  ArrowLeft,
  Users,
  LogOut as ExitIcon,
  Calendar,
  Clock,
  RefreshCw,
  Settings,
} from "lucide-react";
import { APP_DISPLAY_NAME } from "@/lib/appVersion";

interface StudentUser {
  id: string;
  username: string;
  full_name: string;
  school_id: string;
}

interface ClassData {
  id: string;
  class_code: string;
  class_name: string;
  created_at: string;
  teacher_id: string;
}

const ManageClasses = () => {
  const [user, setUser] = useState<StudentUser | null>(null);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const storedUser = sessionStorage.getItem('student_user');
    
    if (!storedUser || !getSessionToken()) {
      navigate('/');
      return;
    }

    const userData = JSON.parse(storedUser);
    setUser(userData);
    void fetchUserClasses();
  }, [navigate]);

  const fetchUserClasses = async () => {
    try {
      let classesData = (await fetchStudentClasses()) as ClassData[];

      if (classesData.length === 0) {
        for (const source of [sessionStorage, localStorage]) {
          const stored = source.getItem('student_class');
          if (stored) {
            try {
              const c = JSON.parse(stored) as ClassData;
              if (c?.id) {
                classesData = [{ ...c, created_at: c.created_at ?? new Date().toISOString(), teacher_id: c.teacher_id ?? '' }];
                break;
              }
            } catch {}
          }
        }
      }
      setClasses(classesData);
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to load your classes.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveClass = async (classId: string, className: string) => {
    if (!user) return;

    try {
      await studentLeaveClass(classId);
      toast({
        title: "Left Class",
        description: `You have left ${className}.`,
      });
      setClasses((prev) => prev.filter((c) => c.id !== classId));
      sessionStorage.removeItem("current_class_id");
      localStorage.removeItem("current_class_id");
      sessionStorage.removeItem("student_class");
      localStorage.removeItem("student_class");
    } catch (error) {
      console.error("Error leaving class:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to leave class.",
        variant: "destructive",
      });
    }
  };

  const handleRefresh = () => {
    if (!user?.id) return;
    setIsRefreshing(true);
    fetchUserClasses().finally(() => setIsRefreshing(false));
  };

  if (!user) return null;

  return (
    <div className="min-h-screen p-4 space-y-6">
      {/* Header — logo + title (entry to this screen is “Manage Classes” on the dashboard only) */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="p-2 rounded-full bg-nexus-primary/10 flex items-center justify-center shrink-0">
            <img
              src="/bluesync-student-logo.svg"
              alt={APP_DISPLAY_NAME}
              className="h-8 w-8 object-contain"
              width={32}
              height={32}
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-nexus-secondary truncate">Your classes</h1>
            <p className="text-sm text-muted-foreground">Classes you&apos;ve joined in this school</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="nexus-ghost"
            size="icon"
            onClick={() => navigate('/dashboard')}
            title="Back to dashboard"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button variant="nexus-outline" size="sm" onClick={() => navigate('/settings')}>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button variant="nexus-outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Classes List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Your Classes</span>
          </CardTitle>
          <CardDescription>
            Classes you've joined in this school
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading your classes...</p>
            </div>
          ) : classes.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <Users className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <h3 className="font-medium">No Classes Joined</h3>
                <p className="text-sm text-muted-foreground">
                  Ask your teacher for a class code to get started
                </p>
              </div>
              <Button
                variant="nexus"
                onClick={() => navigate('/dashboard')}
              >
                Join Your First Class
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {classes.map((classItem) => (
                <div
                  key={classItem.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="space-y-1">
                    <h3 className="font-semibold">{classItem.class_name}</h3>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-3 w-3" />
                        <span>Code: {classItem.class_code}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>Joined {new Date(classItem.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleLeaveClass(classItem.id, classItem.class_name)}
                  >
                    <ExitIcon className="h-4 w-4 mr-2" />
                    Leave Class
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ManageClasses;
