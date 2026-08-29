import React, { useState, useEffect } from "react";
import {
  Music,
  Volume2,
  VolumeX,
  Play,
  Pause,
  CloudRain,
  Radio,
  Coffee,
  Waves,
  TreePine,
  Sparkles,
  Sliders,
} from "lucide-react";
import { soundEngine } from "../utils/audioSynthesizer";

interface SoundscapesViewProps {
  onAwardXp: (amount: number) => void;
}

interface TrackState {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  isPlaying: boolean;
  volume: number; // 0 to 1
  desc: string;
}

export const SoundscapesView: React.FC<SoundscapesViewProps> = ({ onAwardXp }) => {
  const [tracks, setTracks] = useState<TrackState[]>(() => [
    {
      id: "rain",
      name: "Heavy Rain & Drops",
      icon: <CloudRain className="w-5 h-5 text-black" />,
      color: "#00F0FF",
      isPlaying: soundEngine.isTrackPlaying("rain"),
      volume: 0.5,
      desc: "Brown-filtered raindrop acoustics for deep steady immersion",
    },
    {
      id: "binaural",
      name: "40Hz Gamma / Alpha Wave",
      icon: <Waves className="w-5 h-5 text-black" />,
      color: "#FF66C4",
      isPlaying: soundEngine.isTrackPlaying("binaural"),
      volume: 0.4,
      desc: "Dual 200Hz + 240Hz binaural synthesis proven to lock attention",
    },
    {
      id: "vinyl",
      name: "Lo-Fi Vinyl Crackle",
      icon: <Radio className="w-5 h-5 text-black" />,
      color: "#FFE600",
      isPlaying: soundEngine.isTrackPlaying("vinyl"),
      volume: 0.35,
      desc: "Warm analog vinyl needle texture with randomized impulses",
    },
    {
      id: "whitenoise",
      name: "White & Pink Noise",
      icon: <Sliders className="w-5 h-5 text-black" />,
      color: "#73EC8E",
      isPlaying: soundEngine.isTrackPlaying("whitenoise"),
      volume: 0.4,
      desc: "Uniform frequency masking to block background distractions",
    },
    {
      id: "cafe",
      name: "Tokyo Cafe Murmur",
      icon: <Coffee className="w-5 h-5 text-black" />,
      color: "#FFA94D",
      isPlaying: soundEngine.isTrackPlaying("cafe"),
      volume: 0.3,
      desc: "Warm low-frequency coffee shop ambient hum and resonance",
    },
    {
      id: "stream",
      name: "Zen Forest Stream",
      icon: <TreePine className="w-5 h-5 text-black" />,
      color: "#C4B5FD",
      isPlaying: soundEngine.isTrackPlaying("stream"),
      volume: 0.4,
      desc: "Soothing natural mountain water currents & organic flow",
    },
  ]);

  // Keep tracks in sync with any external audio engine changes
  useEffect(() => {
    const unsub = soundEngine.subscribe((_count, activeTracks) => {
      setTracks((prev) =>
        prev.map((t) => ({
          ...t,
          isPlaying: activeTracks.includes(t.id),
        }))
      );
    });
    return () => unsub();
  }, []);

  const handleToggleTrack = (id: string) => {
    soundEngine.playChime("click");
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const nextPlaying = !t.isPlaying;
          soundEngine.setAmbient(t.id, nextPlaying, t.volume);
          if (nextPlaying) onAwardXp(5);
          return { ...t, isPlaying: nextPlaying };
        }
        return t;
      })
    );
  };

  const handleVolumeChange = (id: string, newVol: number) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          if (t.isPlaying) {
            soundEngine.setAmbient(t.id, true, newVol);
          }
          return { ...t, volume: newVol };
        }
        return t;
      })
    );
  };

  const applyPreset = (presetName: "rainy_library" | "deep_alpha" | "lofi_cafe" | "zen_flow") => {
    soundEngine.playChime("success");
    soundEngine.stopAllAmbient();

    const newTracks = tracks.map((t) => ({ ...t, isPlaying: false }));

    if (presetName === "rainy_library") {
      newTracks.forEach((t) => {
        if (t.id === "rain") {
          t.isPlaying = true;
          t.volume = 0.6;
          soundEngine.setAmbient("rain", true, 0.6);
        }
        if (t.id === "vinyl") {
          t.isPlaying = true;
          t.volume = 0.3;
          soundEngine.setAmbient("vinyl", true, 0.3);
        }
      });
    } else if (presetName === "deep_alpha") {
      newTracks.forEach((t) => {
        if (t.id === "binaural") {
          t.isPlaying = true;
          t.volume = 0.5;
          soundEngine.setAmbient("binaural", true, 0.5);
        }
        if (t.id === "whitenoise") {
          t.isPlaying = true;
          t.volume = 0.3;
          soundEngine.setAmbient("whitenoise", true, 0.3);
        }
      });
    } else if (presetName === "lofi_cafe") {
      newTracks.forEach((t) => {
        if (t.id === "cafe") {
          t.isPlaying = true;
          t.volume = 0.4;
          soundEngine.setAmbient("cafe", true, 0.4);
        }
        if (t.id === "vinyl") {
          t.isPlaying = true;
          t.volume = 0.45;
          soundEngine.setAmbient("vinyl", true, 0.45);
        }
      });
    } else if (presetName === "zen_flow") {
      newTracks.forEach((t) => {
        if (t.id === "stream") {
          t.isPlaying = true;
          t.volume = 0.5;
          soundEngine.setAmbient("stream", true, 0.5);
        }
        if (t.id === "binaural") {
          t.isPlaying = true;
          t.volume = 0.3;
          soundEngine.setAmbient("binaural", true, 0.3);
        }
      });
    }

    setTracks(newTracks);
    onAwardXp(15);
  };

  const handleStopAll = () => {
    soundEngine.playChime("click");
    soundEngine.stopAllAmbient();
    setTracks((prev) => prev.map((t) => ({ ...t, isPlaying: false })));
  };

  const activeCount = tracks.filter((t) => t.isPlaying).length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="bg-[#00F0FF] p-2 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <Music className="w-5 h-5 text-black" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black uppercase text-black">
              Lofi & Ambient Soundscapes Mixer
            </h1>
          </div>
          <p className="text-xs font-bold text-gray-700 mt-0.5">
            100% synthesized Web Audio generative background textures
          </p>
        </div>

        {activeCount > 0 && (
          <button
            onClick={handleStopAll}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#FF66C4] border-2 border-black font-black text-xs uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#ff4eb8] active:translate-x-0.5 active:translate-y-0.5"
          >
            <VolumeX className="w-4 h-4" />
            <span>Mute All Layers ({activeCount})</span>
          </button>
        )}
      </div>

      {/* Preset Vibes Bar */}
      <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-2">
        <span className="font-black text-xs uppercase text-black flex items-center gap-1.5">
          <Sparkles className="w-4 h-4" /> 1-Click Study Sound Presets:
        </span>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            onClick={() => applyPreset("rainy_library")}
            className="p-2.5 bg-[#00F0FF]/30 hover:bg-[#00F0FF] border-2 border-black font-black text-xs text-left shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all"
          >
            🌧️ Rainy Library
          </button>
          <button
            onClick={() => applyPreset("deep_alpha")}
            className="p-2.5 bg-[#FF66C4]/30 hover:bg-[#FF66C4] border-2 border-black font-black text-xs text-left shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all"
          >
            🧠 40Hz Deep Lock-In
          </button>
          <button
            onClick={() => applyPreset("lofi_cafe")}
            className="p-2.5 bg-[#FFE600]/30 hover:bg-[#FFE600] border-2 border-black font-black text-xs text-left shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all"
          >
            ☕ Midnight Lo-Fi Cafe
          </button>
          <button
            onClick={() => applyPreset("zen_flow")}
            className="p-2.5 bg-[#73EC8E]/30 hover:bg-[#73EC8E] border-2 border-black font-black text-xs text-left shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all"
          >
            🌲 Zen Stream & Woods
          </button>
        </div>
      </div>

      {/* 6-Track Mixer Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tracks.map((track) => (
          <div
            key={track.id}
            className={`p-5 border-2 border-black transition-all space-y-3 ${
              track.isPlaying
                ? "bg-white shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]"
                : "bg-[#F4F4F0] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
            }`}
          >
            {/* Top Bar: Icon, Name, Power Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="p-2.5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  style={{ backgroundColor: track.color }}
                >
                  {track.icon}
                </div>
                <div>
                  <h3 className="font-black text-sm uppercase text-black">
                    {track.name}
                  </h3>
                  <p className="text-[11px] font-medium text-gray-600 line-clamp-1">
                    {track.desc}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleToggleTrack(track.id)}
                className={`px-3 py-2 border-2 border-black font-black text-xs uppercase transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-1 ${
                  track.isPlaying
                    ? "bg-[#73EC8E] text-black"
                    : "bg-white hover:bg-gray-100 text-black"
                }`}
              >
                {track.isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-black" /> ON
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-black" /> OFF
                  </>
                )}
              </button>
            </div>

            {/* Volume Slider Bar */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-xs font-black uppercase text-gray-700">
                <span>Volume Level</span>
                <span>{Math.round(track.volume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={track.volume}
                onChange={(e) =>
                  handleVolumeChange(track.id, Number(e.target.value))
                }
                className="w-full accent-black cursor-pointer"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
