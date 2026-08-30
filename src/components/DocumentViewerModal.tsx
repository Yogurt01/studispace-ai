import React, { useState, useEffect } from "react";
import {
  X,
  ExternalLink,
  Download,
  Brain,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  FileText,
  FileCode,
  Image as ImageIcon,
  RotateCw,
  Sparkles,
  BookOpen,
  Info,
} from "lucide-react";
import { StudyDocument } from "../types";
import { soundEngine } from "../utils/audioSynthesizer";

interface DocumentViewerModalProps {
  document: StudyDocument | null;
  isOpen: boolean;
  onClose: () => void;
  onAskSocrates?: (docTitle: string, docContext?: string) => void;
  onCreateFlashcards?: (docTitle: string) => void;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  document: doc,
  isOpen,
  onClose,
  onAskSocrates,
  onCreateFlashcards,
}) => {
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasEmbedError, setHasEmbedError] = useState(false);

  useEffect(() => {
    if (isOpen && doc) {
      setZoomLevel(100);
      setRotation(0);
      setIsLoading(true);
      setHasEmbedError(false);
    }
  }, [isOpen, doc]);

  if (!isOpen || !doc) return null;

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes <= 0) return "0 KB";
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case "Textbook":
        return "bg-[#FFE600] text-black";
      case "Lecture Slide":
        return "bg-[#00F0FF] text-black";
      case "Syllabus":
        return "bg-[#73EC8E] text-black";
      case "Exam Paper":
        return "bg-[#FF66C4] text-black";
      default:
        return "bg-[#FFA94D] text-black";
    }
  };

  const isImage = doc.fileType.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(doc.fileName);
  const isPdf = doc.fileType === "application/pdf" || /\.pdf$/i.test(doc.fileName);

  const handleZoomIn = () => {
    soundEngine.playChime("click");
    setZoomLevel((prev) => Math.min(prev + 15, 200));
  };

  const handleZoomOut = () => {
    soundEngine.playChime("click");
    setZoomLevel((prev) => Math.max(prev - 15, 50));
  };

  const handleResetZoom = () => {
    soundEngine.playChime("click");
    setZoomLevel(100);
    setRotation(0);
  };

  const handleRotate = () => {
    soundEngine.playChime("click");
    setRotation((prev) => (prev + 90) % 360);
  };

  const toggleFullscreen = () => {
    soundEngine.playChime("click");
    setIsFullscreen((prev) => !prev);
  };

  const handleDownload = () => {
    soundEngine.playChime("click");
    const link = window.document.createElement("a");
    link.href = doc.fileUrl;
    link.download = doc.fileName;
    link.target = "_blank";
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs transition-all ${
        isFullscreen ? "p-0" : ""
      }`}
    >
      <div
        className={`bg-[#F4F4F0] border-2 border-black flex flex-col transition-all overflow-hidden ${
          isFullscreen
            ? "w-screen h-screen border-0 shadow-none rounded-none"
            : "w-full max-w-6xl h-[92vh] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
        }`}
      >
        {/* Top Header Bar */}
        <div className="bg-white border-b-2 border-black px-4 py-3 flex flex-wrap items-center justify-between gap-3 select-none flex-shrink-0">
          {/* Left: Document Info */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 border-2 border-black bg-[#FFE600] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex-shrink-0">
              {isPdf ? (
                <FileText className="w-5 h-5 text-black" />
              ) : isImage ? (
                <ImageIcon className="w-5 h-5 text-black" />
              ) : (
                <FileCode className="w-5 h-5 text-black" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-black tracking-tight truncate max-w-md lg:max-w-xl">
                  {doc.title}
                </h2>
                <span
                  className={`px-2 py-0.5 border border-black text-[10px] font-black uppercase shadow-[1px_1px_0px_#000] ${getCategoryColor(
                    doc.category
                  )}`}
                >
                  {doc.category}
                </span>
                {doc.courseTag && (
                  <span className="px-2 py-0.5 border border-black bg-[#E2E8F0] text-black text-[10px] font-black shadow-[1px_1px_0px_#000]">
                    {doc.courseTag}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-600 font-bold truncate">
                {doc.fileName} • {formatFileSize(doc.fileSize)} • Added{" "}
                {new Date(doc.uploadedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>

          {/* Right: Quick Action Controls */}
          <div className="flex items-center gap-2 flex-wrap ml-auto">
            {/* Ask Socrates AI */}
            {onAskSocrates && (
              <button
                onClick={() => {
                  soundEngine.playChime("click");
                  onAskSocrates(doc.title, `Context from document: ${doc.title} (${doc.courseTag || "Study Document"})`);
                  onClose();
                }}
                id="btn-doc-ask-socrates"
                title="Ask Socrates AI for insights or summary from this document"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#00F0FF] hover:bg-[#68f5ff] border-2 border-black font-black text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
              >
                <Brain className="w-3.5 h-3.5 text-black" />
                <span>Ask Socrates</span>
              </button>
            )}

            {/* Create Flashcards */}
            {onCreateFlashcards && (
              <button
                onClick={() => {
                  soundEngine.playChime("click");
                  onCreateFlashcards(doc.title);
                  onClose();
                }}
                id="btn-doc-make-cards"
                title="Build flashcard deck based on this document"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#73EC8E] hover:bg-[#9cf5b0] border-2 border-black font-black text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-black" />
                <span>Flashcards</span>
              </button>
            )}

            {/* Download */}
            <button
              onClick={handleDownload}
              id="btn-doc-download"
              title="Download file to computer"
              className="p-1.5 bg-white hover:bg-gray-100 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
            >
              <Download className="w-4 h-4 text-black" />
            </button>

            {/* Open External in New Tab */}
            <a
              href={doc.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              id="btn-doc-open-tab"
              title="Open document in a dedicated new tab"
              className="p-1.5 bg-white hover:bg-[#FFE600] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer flex items-center justify-center"
            >
              <ExternalLink className="w-4 h-4 text-black" />
            </a>

            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              id="btn-doc-fullscreen"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Reader Mode"}
              className="p-1.5 bg-white hover:bg-gray-100 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4 text-black" />
              ) : (
                <Maximize2 className="w-4 h-4 text-black" />
              )}
            </button>

            {/* Close Button */}
            <button
              onClick={() => {
                soundEngine.playChime("click");
                onClose();
              }}
              id="btn-doc-modal-close"
              title="Close Reader"
              className="p-1.5 bg-[#FF4B4B] hover:bg-[#ff6868] text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer ml-1 font-black"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Secondary Sub-toolbar for Reader Controls */}
        <div className="bg-[#EFEFEA] border-b-2 border-black px-4 py-1.5 flex items-center justify-between gap-2 text-xs font-bold select-none flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-gray-600 uppercase tracking-wider text-[10px] font-black">
              Viewer Scale:
            </span>
            <div className="flex items-center border-2 border-black bg-white shadow-[1px_1px_0px_#000]">
              <button
                onClick={handleZoomOut}
                disabled={zoomLevel <= 50}
                className="px-2 py-0.5 hover:bg-gray-100 border-r border-black font-black disabled:opacity-40"
                title="Zoom Out (-15%)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleResetZoom}
                className="px-2.5 py-0.5 hover:bg-[#FFE600] font-black text-xs"
                title="Reset Zoom to 100%"
              >
                {zoomLevel}%
              </button>
              <button
                onClick={handleZoomIn}
                disabled={zoomLevel >= 200}
                className="px-2 py-0.5 hover:bg-gray-100 border-l border-black font-black disabled:opacity-40"
                title="Zoom In (+15%)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            {isImage && (
              <button
                onClick={handleRotate}
                className="flex items-center gap-1 px-2.5 py-1 bg-white border-2 border-black hover:bg-[#FFE600] shadow-[1px_1px_0px_#000] text-xs font-black"
                title="Rotate 90 degrees"
              >
                <RotateCw className="w-3 h-3" />
                <span>Rotate</span>
              </button>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-3 text-gray-500 text-[11px]">
            <span className="flex items-center gap-1">
              <Info className="w-3 h-3 text-blue-500" />
              Distraction-Free Scholar Mode
            </span>
          </div>
        </div>

        {/* Embedded Viewer Canvas Area */}
        <div className="flex-1 relative bg-[#2A2B2E] overflow-auto flex items-center justify-center p-2 sm:p-4">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#2A2B2E]/90 text-white gap-3">
              <div className="w-10 h-10 border-4 border-[#FFE600] border-t-transparent animate-spin rounded-full"></div>
              <p className="font-black text-xs sm:text-sm tracking-wider uppercase">
                Loading Document Stream...
              </p>
            </div>
          )}

          {!doc.fileUrl ? (
            /* A Guest Scholar's upload lives only in the session that made it:
               the object URL cannot be stored, so after a reload the entry is
               here but the file is not. Say that, rather than rendering an
               empty frame that looks like a failed load. */
            <div className="bg-white border-2 border-black p-6 sm:p-8 max-w-md text-center shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <div className="w-12 h-12 bg-[#FFE600] border-2 border-black flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6 text-black" />
              </div>
              <h3 className="font-black text-lg text-black mb-1">File Not Stored</h3>
              <p className="text-xs text-gray-600 font-bold">
                This entry was added in Guest Scholar mode, which keeps documents only for the
                session that uploaded them. Sign in and upload it again to keep the file itself.
              </p>
            </div>
          ) : hasEmbedError ? (
            <div className="bg-white border-2 border-black p-6 sm:p-8 max-w-md text-center shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <div className="w-12 h-12 bg-[#FF66C4] border-2 border-black flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6 text-black" />
              </div>
              <h3 className="font-black text-lg text-black mb-1">
                Preview Incompatible
              </h3>
              <p className="text-xs text-gray-600 mb-4 font-bold">
                This document cannot be previewed directly inside the iframe due to browser sandbox restrictions. You can open it in a new window or download it.
              </p>
              <div className="flex items-center justify-center gap-3">
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-[#FFE600] border-2 border-black font-black text-xs uppercase shadow-[3px_3px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Tab</span>
                </a>
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 bg-white border-2 border-black font-black text-xs uppercase shadow-[3px_3px_0px_#000] hover:bg-gray-100 flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>
            </div>
          ) : isImage ? (
            <div
              className="flex items-center justify-center transition-transform duration-200"
              style={{
                transform: `scale(${zoomLevel / 100}) rotate(${rotation}deg)`,
              }}
            >
              <img
                src={doc.fileUrl}
                alt={doc.title}
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setHasEmbedError(true);
                }}
                className="max-w-full max-h-[80vh] border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] object-contain bg-white"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : isPdf ? (
            <div
              className="w-full h-full flex flex-col items-center justify-center transition-all"
              style={{
                transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : "none",
                transformOrigin: "top center",
              }}
            >
              <iframe
                src={`${doc.fileUrl}#toolbar=1&navpanes=1&scrollbar=1&view=FitH`}
                title={doc.title}
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setHasEmbedError(true);
                }}
                className="w-full h-full min-h-[500px] border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              />
            </div>
          ) : (
            <div
              className="w-full h-full flex flex-col items-center justify-center"
              style={{
                transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : "none",
                transformOrigin: "top center",
              }}
            >
              <iframe
                src={doc.fileUrl}
                title={doc.title}
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setHasEmbedError(true);
                }}
                className="w-full h-full min-h-[500px] border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              />
            </div>
          )}
        </div>

        {/* Bottom Footer Info Bar */}
        <div className="bg-white border-t-2 border-black px-4 py-2 flex flex-wrap items-center justify-between text-xs font-bold select-none flex-shrink-0">
          <div className="flex items-center gap-2 text-gray-700">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-ping"></span>
            <span>StudiSpace Document Vault Encrypted Vault Reader</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-gray-500 text-[11px]">
              Press <kbd className="px-1.5 py-0.5 bg-gray-200 border border-black text-[10px]">ESC</kbd> or close button to exit
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
