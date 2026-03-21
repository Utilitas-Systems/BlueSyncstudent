import { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  audioLevel: number;
  isActive: boolean;
  analyser?: AnalyserNode | null;
}

export const AudioVisualizer = ({ audioLevel, isActive, analyser }: AudioVisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive || !analyser || !canvasRef.current) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isActive || !analyser) return;

      animationFrameRef.current = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = 'rgb(0, 0, 0)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height;

        // Create gradient
        const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
        gradient.addColorStop(0, `hsl(${120 + (dataArray[i] / 255) * 60}, 70%, 50%)`);
        gradient.addColorStop(1, `hsl(${180 + (dataArray[i] / 255) * 60}, 70%, 50%)`);

        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);

        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive, analyser]);

  // Simple bar visualizer when no analyser
  useEffect(() => {
    if (!isActive || analyser || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      if (!isActive) return;

      animationFrameRef.current = requestAnimationFrame(draw);

      ctx.fillStyle = 'rgb(0, 0, 0)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barCount = 32;
      const barWidth = canvas.width / barCount;
      const level = audioLevel / 100;

      for (let i = 0; i < barCount; i++) {
        // Create wave pattern
        const phase = (i / barCount) * Math.PI * 2;
        const variation = Math.sin(Date.now() / 100 + phase) * 0.3 + 0.7;
        const barHeight = (canvas.height * level * variation) * 0.8;

        const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
        const hue = 120 + (level * 60);
        gradient.addColorStop(0, `hsl(${hue}, 70%, 50%)`);
        gradient.addColorStop(1, `hsl(${hue + 30}, 70%, 50%)`);

        ctx.fillStyle = gradient;
        ctx.fillRect(i * barWidth, canvas.height - barHeight, barWidth - 2, barHeight);
      }
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive, audioLevel, analyser]);

  return (
    <div className="w-full bg-black rounded-lg overflow-hidden">
      <canvas
        ref={canvasRef}
        width={400}
        height={100}
        className="w-full h-24"
      />
    </div>
  );
};



