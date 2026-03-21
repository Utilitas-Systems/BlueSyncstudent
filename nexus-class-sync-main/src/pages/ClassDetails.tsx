import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getSupabaseForAppUser } from "@/integrations/supabase/app-client";
import { useTeacherBroadcast } from "@/hooks/useTeacherBroadcast";
import {
  ArrowLeft,
  Users,
  Bluetooth,
  Monitor,
  Smartphone,
  Headphones,
  RefreshCw,
  Wifi,
  WifiOff,
  Bell,
  Volume2,
} from "lucide-react";

interface TeacherUser {
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

interface Student {
  id: string;
  username: string;
  full_name: string;
  is_online?: boolean;
  class_id?: string;
}

interface BluetoothDevice {
  id: string;
  name: string;
  type: string;
  connected: boolean;
  sharing: boolean;
}

const getDeviceIcon = (type: string) => {
  switch (type?.toLowerCase()) {
    case 'monitor':
    case 'display':
      return <Monitor className="h-5 w-5" />;
    case 'smartphone':
    case 'phone':
      return <Smartphone className="h-5 w-5" />;
    case 'headphones':
    case 'headset':
      return <Headphones className="h-5 w-5" />;
    default:
      return <Bluetooth className="h-5 w-5" />;
  }
};

const ClassDetails = () => {
  const { classId } = useParams<{ classId: string }>();
  const [user, setUser] = useState<TeacherUser | null>(null);
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Listen for device and audio broadcasts from students
  const { studentDevices, studentAudio } = useTeacherBroadcast({
    classId: classId || null,
    onDeviceUpdate: (data) => {
      console.log('[teacher] Device update received:', data);
      toast({
        title: "Device Update",
        description: `Student ${data.student_id} updated their devices`,
      });
    },
  });

  useEffect(() => {
    const storedUser = sessionStorage.getItem('teacher_user');
    
    if (!storedUser) {
      navigate('/');
      return;
    }

    const userData = JSON.parse(storedUser);
    setUser(userData);

    if (classId) {
      fetchClassData(classId, userData.id);
      fetchStudents(classId);
    }
  }, [classId, navigate]);

  const fetchClassData = async (classId: string, teacherId: string) => {
    try {
      const db = getSupabaseForAppUser(teacherId);
      const { data, error } = await db
        .from('classes')
        .select('*')
        .eq('id', classId)
        .eq('teacher_id', teacherId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching class:', error);
        toast({
          title: "Error",
          description: "Failed to load class information.",
          variant: "destructive",
        });
        navigate('/dashboard');
      } else if (data) {
        setClassData(data);
      } else {
        toast({
          title: "Not Found",
          description: "Class not found or you don't have access.",
          variant: "destructive",
        });
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStudents = async (classId: string) => {
    try {
      const { data, error } = await supabase
        .from('class_students')
        .select(`
          students (
            id,
            username,
            full_name,
            is_online,
            class_id
          )
        `)
        .eq('class_id', classId);

      if (error) {
        console.error('Error fetching students:', error);
      } else {
        const studentList = data
          ?.map((item: any) => item.students)
          .filter(Boolean) || [];
        setStudents(studentList as Student[]);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleRefresh = () => {
    if (classId) {
      fetchStudents(classId);
      toast({
        title: "Refreshed",
        description: "Student list updated.",
      });
    }
  };

  const sendIndividualAlert = async (studentId: string, studentName: string) => {
    if (!classId) return;
    try {
      const ch = supabase.channel(`student_${studentId}_alerts`, { config: { broadcast: { self: true } } });
      await new Promise<void>((resolve, reject) => {
        ch.subscribe((status) => {
          if (status === "SUBSCRIBED") resolve();
          if (status === "CHANNEL_ERROR") reject(new Error("Subscribe failed"));
        });
      });
      await ch.send({
        type: "broadcast",
        event: "student_alert",
        payload: { student_id: studentId, message: "Teacher needs your attention", timestamp: new Date().toISOString(), alert_type: "individual" },
      });
      supabase.removeChannel(ch);
      toast({ title: "Alert sent", description: `Attention request sent to ${studentName}` });
    } catch (e) {
      console.error("[ClassDetails] sendIndividualAlert:", e);
      toast({ title: "Failed to send alert", variant: "destructive" });
    }
  };

  const sendClassAlert = async () => {
    if (!classId) return;
    try {
      const ch = supabase.channel(`class_${classId}_alerts`, { config: { broadcast: { self: true } } });
      await new Promise<void>((resolve, reject) => {
        ch.subscribe((status) => {
          if (status === "SUBSCRIBED") resolve();
          if (status === "CHANNEL_ERROR") reject(new Error("Subscribe failed"));
        });
      });
      await ch.send({
        type: "broadcast",
        event: "all_students_alert",
        payload: { message: "Teacher needs everyone's attention", timestamp: new Date().toISOString(), alert_type: "all" },
      });
      supabase.removeChannel(ch);
      toast({ title: "Class alert sent", description: "All students received the attention request" });
    } catch (e) {
      console.error("[ClassDetails] sendClassAlert:", e);
      toast({ title: "Failed to send class alert", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading class details...</p>
        </div>
      </div>
    );
  }

  if (!classData || !user) return null;

  return (
    <div className="min-h-screen p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="nexus-ghost"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-nexus-secondary">{classData.class_name}</h1>
            <p className="text-sm text-muted-foreground">Class Code: {classData.class_code}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="nexus" onClick={sendClassAlert} disabled={students.length === 0}>
            <Bell className="h-4 w-4 mr-2" />
            Get Everyone&apos;s Attention
          </Button>
          <Button variant="nexus-outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Students List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Students ({students.length})</span>
          </CardTitle>
          <CardDescription>
            View student devices and status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No students in this class yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {students.map((student) => {
                const devices = studentDevices.get(student.id) || [];
                const audio = studentAudio.get(student.id);
                const onlineStatus = student.is_online ? 'online' : 'offline';
                
                return (
                  <Card key={student.id} className="border-l-4 border-l-nexus-primary">
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        {/* Student Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`h-3 w-3 rounded-full ${
                              student.is_online ? 'bg-nexus-success' : 'bg-muted-foreground'
                            }`} />
                            <div>
                              <h3 className="font-semibold text-lg">
                                {student.full_name || student.username}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                @{student.username} • {onlineStatus}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="nexus-outline"
                              size="sm"
                              onClick={() => sendIndividualAlert(student.id, student.full_name || student.username)}
                              title="Get this student's attention"
                            >
                              <Volume2 className="h-4 w-4 mr-1" />
                              Get attention
                            </Button>
                            {student.is_online ? (
                              <Wifi className="h-4 w-4 text-nexus-success" />
                            ) : (
                              <WifiOff className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>

                        {/* Audio Level */}
                        {audio && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">System Audio</span>
                              <span className="font-medium">{audio.audioLevel}%</span>
                            </div>
                            <Progress value={audio.audioLevel} className="h-2" />
                          </div>
                        )}

                        {/* Devices */}
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Bluetooth className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              Devices ({devices.length})
                            </span>
                          </div>
                          {devices.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {devices.map((device) => (
                                <div
                                  key={device.id}
                                  className="flex items-center space-x-3 p-3 border rounded-lg bg-accent/50"
                                >
                                  <div className={`p-2 rounded-full ${
                                    device.connected 
                                      ? 'bg-nexus-success/10 text-nexus-success' 
                                      : 'bg-muted text-muted-foreground'
                                  }`}>
                                    {getDeviceIcon(device.type)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-sm truncate">
                                      {device.name}
                                    </h4>
                                    <p className="text-xs text-muted-foreground">
                                      {device.connected ? 'Connected' : 'Disconnected'}
                                      {device.sharing && ' • Sharing'}
                                    </p>
                                  </div>
                                  <div className={`h-2 w-2 rounded-full ${
                                    device.connected ? 'bg-nexus-success' : 'bg-muted-foreground'
                                  }`} />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground py-2">
                              No devices reported yet
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClassDetails;


