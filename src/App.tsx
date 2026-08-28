import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, ShieldCheck, ShieldAlert, ShieldX, Scan, AlertCircle, Loader2, StopCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type DetectionStatus = 'mask' | 'no_mask' | 'incorrect' | 'no_face' | 'idle' | 'detecting' | 'error';

interface DetectionResult {
  status: DetectionStatus;
  message: string;
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<DetectionStatus>('idle');
  const [message, setMessage] = useState<string>('Ready to scan. Please position your face in the camera.');
  const [isAutoScanning, setIsAutoScanning] = useState(false);

  // Initialize camera
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setStatus('error');
      setMessage('Unable to access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
    setIsAutoScanning(false);
    setStatus('idle');
    setMessage('Camera stopped.');
  };

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []); // Initial load

  const captureAndDetect = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    if (status === 'detecting') return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context || video.readyState !== video.HAVE_ENOUGH_DATA) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get base64 string
    const base64Image = canvas.toDataURL('image/jpeg', 0.8);

    setStatus('detecting');
    setMessage('Analyzing frame...');

    try {
      const response = await fetch('/api/detect-mask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image }),
      });

      if (!response.ok) {
        throw new Error('Detection failed');
      }

      const result: DetectionResult = await response.json();
      setStatus(result.status);
      setMessage(result.message);
    } catch (err) {
      console.error(err);
      setStatus('error');
      setMessage('An error occurred during analysis. Please try again.');
    }
  }, [status]);

  // Auto-scanning logic
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (isAutoScanning && stream) {
      intervalId = setInterval(() => {
        captureAndDetect();
      }, 3000); // scan every 3 seconds
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isAutoScanning, stream, captureAndDetect]);

  const getStatusConfig = () => {
    switch (status) {
      case 'mask':
        return { color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500', icon: <ShieldCheck className="w-8 h-8 text-emerald-500" />, title: 'Mask Detected' };
      case 'no_mask':
        return { color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500', icon: <ShieldX className="w-8 h-8 text-rose-500" />, title: 'No Mask Detected' };
      case 'incorrect':
        return { color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500', icon: <ShieldAlert className="w-8 h-8 text-amber-500" />, title: 'Incorrect Mask' };
      case 'no_face':
        return { color: 'text-slate-400', bg: 'bg-slate-400/10', border: 'border-slate-400', icon: <AlertCircle className="w-8 h-8 text-slate-400" />, title: 'No Face Detected' };
      case 'detecting':
        return { color: 'text-indigo-400', bg: 'bg-indigo-400/10', border: 'border-indigo-400', icon: <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />, title: 'Scanning...' };
      case 'error':
        return { color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500', icon: <AlertCircle className="w-8 h-8 text-red-500" />, title: 'System Error' };
      default:
        return { color: 'text-slate-400', bg: 'bg-slate-800', border: 'border-slate-700', icon: <Camera className="w-8 h-8 text-slate-400" />, title: 'Ready' };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col font-sans selection:bg-indigo-500/30">
      
      {/* Header */}
      <header className="border-b border-slate-800/60 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
              <Scan className="w-5 h-5 text-indigo-400" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-100">Face Mask Vision</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${stream ? 'bg-emerald-400' : 'bg-slate-500'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${stream ? 'bg-emerald-500' : 'bg-slate-500'}`}></span>
            </span>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              {stream ? 'Camera Active' : 'Camera Off'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Camera Viewport */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl aspect-video flex items-center justify-center">
            
            {!stream && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 z-10 bg-slate-900">
                <Camera className="w-12 h-12 mb-3 opacity-50" />
                <p>Camera is turned off</p>
              </div>
            )}
            
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className={`w-full h-full object-cover transition-opacity duration-300 ${stream ? 'opacity-100' : 'opacity-0'}`}
            />
            
            {/* Overlay Grid */}
            {stream && (
              <div className="absolute inset-0 pointer-events-none opacity-20">
                <div className="w-full h-full border-[1px] border-indigo-500/30 grid grid-cols-3 grid-rows-3">
                  <div className="border-r border-b border-indigo-500/30"></div>
                  <div className="border-r border-b border-indigo-500/30"></div>
                  <div className="border-b border-indigo-500/30"></div>
                  <div className="border-r border-b border-indigo-500/30"></div>
                  <div className="border-r border-b border-indigo-500/30 relative flex items-center justify-center">
                    <div className="w-16 h-16 border border-indigo-400/50 rounded-full"></div>
                  </div>
                  <div className="border-b border-indigo-500/30"></div>
                  <div className="border-r border-indigo-500/30"></div>
                  <div className="border-r border-indigo-500/30"></div>
                  <div></div>
                </div>
              </div>
            )}

            {/* Scanning indicator */}
            <AnimatePresence>
              {status === 'detecting' && (
                <motion.div 
                  initial={{ top: '0%' }}
                  animate={{ top: '100%' }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  className="absolute left-0 right-0 h-1 bg-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.5)] z-20"
                />
              )}
            </AnimatePresence>

            <canvas ref={canvasRef} className="hidden" />
          </div>

          <div className="flex gap-4 items-center">
            {stream ? (
              <button 
                onClick={stopCamera}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                <StopCircle className="w-5 h-5" />
                Stop Camera
              </button>
            ) : (
              <button 
                onClick={startCamera}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
              >
                <Camera className="w-5 h-5" />
                Start Camera
              </button>
            )}

            <button 
              onClick={captureAndDetect}
              disabled={!stream || status === 'detecting'}
              className="flex-[2] bg-slate-100 hover:bg-white text-slate-900 disabled:bg-slate-800 disabled:text-slate-500 px-4 py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed"
            >
              <Scan className="w-5 h-5" />
              {status === 'detecting' ? 'Analyzing...' : 'Scan Now'}
            </button>
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          <div className={`p-6 rounded-2xl border transition-all duration-500 ${config.bg} ${config.border} shadow-lg relative overflow-hidden`}>
            {/* Background glow */}
            <div className={`absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 rounded-full blur-3xl opacity-20 ${config.bg.replace('/10', '')}`} />
            
            <div className="flex flex-col gap-4 relative z-10">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl bg-slate-900/50 border border-slate-700/50 shadow-inner`}>
                  {config.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-400 uppercase tracking-widest mb-1">Status</p>
                  <h2 className={`text-xl font-bold ${config.color}`}>{config.title}</h2>
                </div>
              </div>
              
              <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent my-2"></div>
              
              <div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {message}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-slate-200">Auto-Scan Mode</h3>
              <button
                onClick={() => setIsAutoScanning(!isAutoScanning)}
                disabled={!stream}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                  isAutoScanning ? 'bg-indigo-500' : 'bg-slate-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isAutoScanning ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              When enabled, the system will automatically analyze the video feed every 3 seconds to detect face mask compliance continuously.
            </p>
            
            <div className="mt-6 space-y-3">
               <div className="flex items-center gap-3 text-sm text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Properly worn mask over nose and mouth</span>
               </div>
               <div className="flex items-center gap-3 text-sm text-slate-400">
                  <ShieldX className="w-4 h-4 text-rose-500" />
                  <span>No face mask detected</span>
               </div>
               <div className="flex items-center gap-3 text-sm text-slate-400">
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                  <span>Mask worn incorrectly (e.g. below nose)</span>
               </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

