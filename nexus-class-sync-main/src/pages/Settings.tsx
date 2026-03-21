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
import { Slider } from "@/components/ui/slider";

const Settings = () => {
  const [isOffline, setIsOffline] = useState(false);
  const [chimeVolume, setChimeVolume] = useState(() => {
    const saved = localStorage.getItem('chimeVolume');
    return saved ? Math.max(0.3, parseFloat(saved)) : 0.5;
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const storedUser = sessionStorage.getItem('student_user');
    if (!storedUser) {
      navigate('/');
      return;
    }
  }, [navigate]);

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
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="nexus-ghost"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-nexus-secondary">Settings</h1>
            <p className="text-sm text-muted-foreground">Device sharing and notification preferences</p>
          </div>
        </div>
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
