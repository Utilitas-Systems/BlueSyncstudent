import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  EyeOff,
  Eye,
  Bluetooth,
  BluetoothOff,
  Volume2,
} from "lucide-react";
import { APP_DISPLAY_NAME } from "@/lib/appVersion";
import { Slider } from "@/components/ui/slider";
import {
  isMockBluetoothEnabled,
  MOCK_BLUETOOTH_DEVICE,
  onMockBluetoothChanged,
  setMockBluetoothEnabled,
} from "@/lib/mockBluetoothDevices";
import { useBroadcastPresence } from "@/hooks/useBroadcastPresence";
import { pushStudentDeviceList, readStudentDeviceContext } from "@/lib/pushStudentDeviceList";
import { updateStudentStatus } from "@/lib/studentRpc";
import { Badge } from "@/components/ui/badge";

const Settings = () => {
  const [isOffline, setIsOffline] = useState(false);
  const [studentUser, setStudentUser] = useState<{ id: string; username?: string; full_name?: string } | null>(null);
  const [classId, setClassId] = useState("");
  const [chimeVolume, setChimeVolume] = useState(() => {
    const saved = localStorage.getItem('chimeVolume');
    return saved ? Math.max(0.3, parseFloat(saved)) : 0.5;
  });
  const [mockDeviceEnabled, setMockDeviceEnabled] = useState(() => isMockBluetoothEnabled());
  const navigate = useNavigate();
  const { toast } = useToast();

  const { startPresence } = useBroadcastPresence({
    student: {
      id: studentUser?.id || "",
      username: studentUser?.username,
      full_name: studentUser?.full_name,
    },
    classId,
  });

  useEffect(() => {
    const storedUser = sessionStorage.getItem('student_user');
    if (!storedUser) {
      navigate('/');
      return;
    }
    try {
      const parsed = JSON.parse(storedUser);
      setStudentUser(parsed);
    } catch {
      navigate('/');
      return;
    }
    const classRaw =
      sessionStorage.getItem('student_class') ?? localStorage.getItem('student_class');
    if (classRaw) {
      try {
        const cls = JSON.parse(classRaw);
        if (cls?.id) setClassId(cls.id);
      } catch {
        /* ignore */
      }
    }
    return onMockBluetoothChanged(() => setMockDeviceEnabled(isMockBluetoothEnabled()));
  }, [navigate]);

  useEffect(() => {
    if (!studentUser?.id || !classId) return;
    startPresence();
    void updateStudentStatus(true);
  }, [studentUser?.id, classId, startPresence]);

  const syncMockToServer = () => {
    const ctx = readStudentDeviceContext();
    if (!ctx) {
      toast({
        title: "Join a class first",
        description: "You need to be in a class before sharing a test device.",
        variant: "destructive",
      });
      return;
    }
    void pushStudentDeviceList(ctx.studentId, ctx.classId, []);
  };

  const handleAddMockDevice = () => {
    setMockBluetoothEnabled(true);
    setMockDeviceEnabled(true);
    syncMockToServer();
    toast({
      title: "Test device added",
      description: `${MOCK_BLUETOOTH_DEVICE.name} is now shared with your class.`,
    });
  };

  const handleRemoveMockDevice = () => {
    setMockBluetoothEnabled(false);
    setMockDeviceEnabled(false);
    syncMockToServer();
    toast({
      title: "Test device removed",
      description: "The fake Bluetooth device will no longer be shared.",
    });
  };

  const handleOfflineToggle = (checked: boolean) => {
    setIsOffline(checked);
    toast({
      title: checked ? "Appearing Offline" : "Back Online",
      description: checked 
        ? "Your devices won't be shared with teachers" 
        : "Your devices are now available for sharing",
    });
  };

  const handleChimeVolumeChange = (value: number[]) => {
    const newVolume = Math.max(0.3, value[0]);
    setChimeVolume(newVolume);
    localStorage.setItem('chimeVolume', newVolume.toString());
    toast({
      title: "Chime Volume Updated",
      description: `Volume set to ${Math.round(newVolume * 100)}%`,
    });
  };

  return (
    <div className="min-h-screen p-4 space-y-6">
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
            <h1 className="text-2xl font-bold text-nexus-secondary truncate">Settings</h1>
            <p className="text-sm text-muted-foreground">Device sharing and notification preferences</p>
          </div>
        </div>
        <Button
          variant="nexus-ghost"
          size="icon"
          onClick={() => navigate('/dashboard')}
          title="Back to dashboard"
          aria-label="Back to dashboard"
          className="shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            {isOffline ? <BluetoothOff className="h-5 w-5" /> : <Bluetooth className="h-5 w-5" />}
            <span>Device Sharing Status</span>
          </CardTitle>
          <CardDescription>
            Control whether your bluetooth devices are visible to teachers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="offline-mode" className="text-base font-medium">
                {isOffline ? "Appear Offline" : "Online & Sharing"}
              </Label>
              <p className="text-sm text-muted-foreground">
                {isOffline 
                  ? "Your devices are hidden from teachers" 
                  : "Your devices are available for classroom sharing"
                }
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {isOffline ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              <Switch
                id="offline-mode"
                checked={isOffline}
                onCheckedChange={handleOfflineToggle}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bluetooth className="h-5 w-5" />
            <span>Testing</span>
          </CardTitle>
          <CardDescription>
            Add a fake Bluetooth device for demos — not a real paired device
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mockDeviceEnabled ? (
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{MOCK_BLUETOOTH_DEVICE.name}</span>
                  <Badge variant="secondary">Mock</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Included when you scan on the dashboard. Teachers see it labeled as not real.
                </p>
              </div>
              <Button variant="outline" onClick={handleRemoveMockDevice} className="shrink-0">
                Remove
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={handleAddMockDevice} className="w-full sm:w-auto">
              <Bluetooth className="h-4 w-4 mr-2" />
              Add test Bluetooth device
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Volume2 className="h-5 w-5" />
            <span>Notification Chime Volume</span>
          </CardTitle>
          <CardDescription>
            Adjust the volume of attention notification chimes (minimum 30%)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">
                Volume: {Math.round(chimeVolume * 100)}%
              </Label>
              <span className="text-sm text-muted-foreground">Min: 30%</span>
            </div>
            <Slider
              value={[chimeVolume]}
              onValueChange={handleChimeVolumeChange}
              min={0.3}
              max={1.0}
              step={0.05}
              className="w-full"
            />
            <p className="text-sm text-muted-foreground">
              The chime will play at {Math.round(chimeVolume * 100)}% volume when you receive attention notifications.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
