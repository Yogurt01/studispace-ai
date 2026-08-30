import React, { useState, useMemo, useRef } from "react";
import {
  AlertCircle,
  FolderLock,
  UploadCloud,
  Search,
  Filter,
  FileText,
  FileCode,
  Image as ImageIcon,
  Pin,
  Trash2,
  ExternalLink,
  Download,
  Brain,
  Layers,
  Sparkles,
  CheckCircle2,
  HardDrive,
  BookOpen,
  Eye,
  Plus,
  X,
  ArrowUpDown,
  LayoutGrid,
  List as ListIcon,
  Tag,
  GraduationCap,
} from "lucide-react";
import { StudyDocument, DocumentCategory, CourseGrade } from "../types";
import { soundEngine } from "../utils/audioSynthesizer";
import { ACCEPTED_FILE_INPUT, validateDocumentFile } from "../utils/documentValidation";
import { isStorageUnavailable, storageKnownUnavailable } from "../utils/firestoreService";
import { DocumentViewerModal } from "./DocumentViewerModal";

interface DocumentVaultViewProps {
  documents: StudyDocument[];
  onUploadDocument: (
    file: File,
    metadata?: Partial<StudyDocument>,
    onProgress?: (percent: number) => void
  ) => Promise<StudyDocument>;
  onDeleteDocument: (id: string, storagePath?: string) => Promise<void>;
  onTogglePinDocument: (id: string, pinned: boolean) => Promise<void>;
  onAwardXp: (amount: number) => void;
  onAskSocrates?: (title: string, context?: string) => void;
  onCreateFlashcards?: (title: string) => void;
  courses?: CourseGrade[];
}

const CATEGORIES: DocumentCategory[] = [
  "Textbook",
  "Lecture Slide",
  "Syllabus",
  "Exam Paper",
  "Other",
];

const CATEGORY_COLORS: Record<DocumentCategory, { bg: string; text: string }> = {
  Textbook: { bg: "#FFE600", text: "#000" },
  "Lecture Slide": { bg: "#00F0FF", text: "#000" },
  Syllabus: { bg: "#73EC8E", text: "#000" },
  "Exam Paper": { bg: "#FF66C4", text: "#000" },
  Other: { bg: "#FFA94D", text: "#000" },
};

export const DocumentVaultView: React.FC<DocumentVaultViewProps> = ({
  documents,
  onUploadDocument,
  onDeleteDocument,
  onTogglePinDocument,
  onAwardXp,
  onAskSocrates,
  onCreateFlashcards,
  courses = [],
}) => {
  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedCourseTag, setSelectedCourseTag] = useState<string>("All");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "title" | "size">("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Active Reader Modal state
  const [selectedDocForViewer, setSelectedDocForViewer] = useState<StudyDocument | null>(null);

  // Upload Form states
  const [isUploadDrawerOpen, setIsUploadDrawerOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory>("Lecture Slide");
  const [uploadCourseTag, setUploadCourseTag] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  // Set when Cloud Storage is not provisioned for the project. The vault stays
  // fully usable — reading, filtering, opening seeded documents — so this is a
  // banner about one capability, not an error state for the whole view.
  const [storageUnavailable, setStorageUnavailable] = useState(storageKnownUnavailable());

  // Delete Confirmation state
  const [docToDelete, setDocToDelete] = useState<StudyDocument | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Derive unique course tags from existing documents and GPA courses
  const allCourseTags = useMemo(() => {
    const set = new Set<string>();
    courses.forEach((c) => set.add(c.courseCode));
    documents.forEach((d) => {
      if (d.courseTag) set.add(d.courseTag);
    });
    return Array.from(set).sort();
  }, [courses, documents]);

  // Compute storage statistics
  const totalSizeBytes = useMemo(() => {
    return documents.reduce((acc, doc) => acc + (doc.fileSize || 0), 0);
  }, [documents]);

  const storageLimitBytes = 500 * 1024 * 1024; // 500 MB Free Tier
  const storageUsedPercent = Math.min(
    Math.round((totalSizeBytes / storageLimitBytes) * 100),
    100
  );

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes <= 0) return "0 KB";
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Filtered & Sorted documents
  const filteredDocuments = useMemo(() => {
    return documents
      .filter((doc) => {
        const matchesQuery =
          !searchQuery.trim() ||
          doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (doc.courseTag && doc.courseTag.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesCategory =
          selectedCategory === "All" || doc.category === selectedCategory;

        const matchesCourse =
          selectedCourseTag === "All" || doc.courseTag === selectedCourseTag;

        return matchesQuery && matchesCategory && matchesCourse;
      })
      .sort((a, b) => {
        // Pinned documents always float to top unless sorting purely by alphabetical
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;

        if (sortBy === "newest") {
          return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
        }
        if (sortBy === "oldest") {
          return new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
        }
        if (sortBy === "title") {
          return a.title.localeCompare(b.title);
        }
        if (sortBy === "size") {
          return (b.fileSize || 0) - (a.fileSize || 0);
        }
        return 0;
      });
  }, [documents, searchQuery, selectedCategory, selectedCourseTag, sortBy]);

  // File drop & select handlers. Both go through one check: the input's accept
  // list is only a picker filter and drag-and-drop ignores it entirely, so
  // without this an unsupported or oversized file reaches Storage and fails
  // there, after the student has waited on the transfer.
  const acceptFile = (file: File) => {
    const check = validateDocumentFile(file);
    if (!check.ok) {
      setUploadFile(null);
      setUploadError(check.message ?? "That file cannot be added to the vault.");
      soundEngine.playChime("click");
      return;
    }

    setUploadError(null);
    setUploadFile(file);
    if (!uploadTitle) {
      setUploadTitle(file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " "));
    }
    soundEngine.playChime("click");
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      acceptFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      acceptFile(e.target.files[0]);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError("Please select a file to upload.");
      return;
    }

    const check = validateDocumentFile(uploadFile);
    if (!check.ok) {
      setUploadError(check.message ?? "That file cannot be added to the vault.");
      return;
    }

    try {
      setIsUploading(true);
      setUploadError(null);
      setUploadProgress(0);

      // Real transfer progress. This used to be a setInterval that climbed to
      // 85% and stopped, at the same speed for a 2KB note as for a 16MB
      // textbook — so a large upload looked identical to a hung one.
      await onUploadDocument(
        uploadFile,
        {
          title: uploadTitle.trim() || uploadFile.name,
          category: uploadCategory,
          courseTag: uploadCourseTag.trim() || "General",
          pinned: false,
        },
        (percent) => setUploadProgress(percent)
      );

      setUploadProgress(100);

      soundEngine.playChime("levelup");
      onAwardXp(20);

      // Reset form
      setTimeout(() => {
        setIsUploading(false);
        setIsUploadDrawerOpen(false);
        setUploadFile(null);
        setUploadTitle("");
        setUploadCourseTag("");
        setUploadProgress(0);
      }, 500);
    } catch (err: any) {
      console.error("Upload error:", err);
      setIsUploading(false);
      // The drawer stays open on the error so the student can retry; leaving the
      // bar parked at 85% would read as an upload still in flight.
      setUploadProgress(0);
      if (isStorageUnavailable(err)) setStorageUnavailable(true);
      setUploadError(err?.message || "Failed to upload document. Please try again.");
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!docToDelete) return;
    soundEngine.playChime("click");
    await onDeleteDocument(docToDelete.id, docToDelete.storagePath);
    setDocToDelete(null);
  };

  const isPdf = (doc: StudyDocument) =>
    doc.fileType === "application/pdf" || /\.pdf$/i.test(doc.fileName);
  const isImage = (doc: StudyDocument) =>
    doc.fileType.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)$/i.test(doc.fileName);

  return (
    <div className="space-y-6 pb-16">
      {/* Top Banner & Header Metric Cards */}
      <div className="bg-[#FFE600] border-2 border-black p-4 sm:p-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 bg-black text-[#FFE600] text-xs font-black uppercase tracking-wider">
                Academic Library
              </span>
              <span className="flex items-center gap-1 text-xs font-bold text-black">
                <Sparkles className="w-3.5 h-3.5 text-black" />
                In-App PDF & Document Reader
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight flex items-center gap-2">
              <span>📂</span> Document Vault
            </h1>
            <p className="text-xs sm:text-sm font-bold text-black/80 max-w-2xl mt-1">
              Upload, organize, tag, and read your textbooks, lecture slides, exam formula sheets, and syllabi in a high-speed, distraction-free environment.
            </p>
          </div>

          {/* Action: Open Upload Drawer */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                soundEngine.playChime("click");
                setIsUploadDrawerOpen(true);
              }}
              id="btn-vault-upload-trigger"
              className="px-5 py-2.5 bg-[#00F0FF] hover:bg-[#6df6ff] border-2 border-black font-black text-xs sm:text-sm uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-[1px_1px_0px_#000] transition-all flex items-center gap-2 cursor-pointer"
            >
              <UploadCloud className="w-4 h-4 text-black" />
              <span>Upload Document (+20 XP)</span>
            </button>
          </div>
        </div>

        {/* Cloud Storage is a provisioned Firebase resource, not something this
            app can create. When the project has none, saying so once here is
            better than letting every upload discover it separately — and the
            rest of the vault keeps working, so this is a notice, not an error. */}
        {storageUnavailable && (
          <div
            id="vault-storage-unavailable-notice"
            role="status"
            className="mt-5 bg-[#FFE600] border-2 border-black p-3 sm:p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-black shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-black text-xs sm:text-sm uppercase text-black">
                Cloud uploads are unavailable
              </p>
              <p className="text-xs font-bold text-black/80">
                Cloud Storage is not enabled for this Firebase project, so new files cannot be
                stored. Enable Storage in the Firebase Console and check that
                VITE_FIREBASE_STORAGE_BUCKET names an existing bucket. Reading, searching, and
                opening the documents already in your vault all keep working.
              </p>
            </div>
          </div>
        )}

        {/* Quick Storage & Inventory Metric Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-4 border-t-2 border-black/20">
          {/* Metric 1: Total Docs */}
          <div className="bg-white border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-gray-500">Vault Inventory</p>
              <p className="text-xl font-black text-black">{documents.length} Docs</p>
            </div>
            <div className="p-2 bg-[#FFE600] border-2 border-black">
              <BookOpen className="w-4 h-4 text-black" />
            </div>
          </div>

          {/* Metric 2: Pinned Quick-Access */}
          <div className="bg-white border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-gray-500">Pinned Resources</p>
              <p className="text-xl font-black text-black">
                {documents.filter((d) => d.pinned).length} Pinned
              </p>
            </div>
            <div className="p-2 bg-[#FF66C4] border-2 border-black">
              <Pin className="w-4 h-4 text-black" />
            </div>
          </div>

          {/* Metric 3: Storage Quota */}
          <div className="bg-white border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-black uppercase text-gray-500">Cloud Storage Usage</p>
              <p className="text-xs font-black text-black">
                {formatFileSize(totalSizeBytes)} / 500 MB
              </p>
            </div>
            <div className="w-full h-2.5 bg-gray-200 border border-black overflow-hidden">
              <div
                className="h-full bg-[#73EC8E] border-r border-black transition-all duration-500"
                style={{ width: `${Math.max(storageUsedPercent, 3)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Category Filters, Course Select, View Switcher */}
      <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents by title, file name, or course code (e.g., CS 201)..."
              className="w-full pl-9 pr-3 py-2 border-2 border-black font-bold text-xs sm:text-sm focus:bg-[#FFFDE6] focus:outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              id="input-vault-search"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-black text-gray-500 hover:text-black"
              >
                ✕
              </button>
            )}
          </div>

          {/* Sort & View Mode Switches */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Course Tag Dropdown */}
            {allCourseTags.length > 0 && (
              <select
                value={selectedCourseTag}
                onChange={(e) => setSelectedCourseTag(e.target.value)}
                className="px-3 py-2 border-2 border-black font-black text-xs bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:outline-none cursor-pointer"
                id="select-vault-course"
              >
                <option value="All">All Courses</option>
                {allCourseTags.map((tag) => (
                  <option key={tag} value={tag}>
                    📚 {tag}
                  </option>
                ))}
              </select>
            )}

            {/* Sort Dropdown */}
            <div className="flex items-center border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] px-2 py-1.5 gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-gray-600" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="font-black text-xs bg-transparent focus:outline-none cursor-pointer"
                id="select-vault-sort"
              >
                <option value="newest">Newest Uploads</option>
                <option value="oldest">Oldest First</option>
                <option value="title">Title (A-Z)</option>
                <option value="size">Largest Size</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <button
                onClick={() => {
                  soundEngine.playChime("click");
                  setViewMode("grid");
                }}
                className={`p-1.5 transition-colors ${
                  viewMode === "grid" ? "bg-[#FFE600]" : "hover:bg-gray-100"
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4 text-black" />
              </button>
              <button
                onClick={() => {
                  soundEngine.playChime("click");
                  setViewMode("list");
                }}
                className={`p-1.5 border-l border-black transition-colors ${
                  viewMode === "list" ? "bg-[#FFE600]" : "hover:bg-gray-100"
                }`}
                title="List View"
              >
                <ListIcon className="w-4 h-4 text-black" />
              </button>
            </div>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
          <button
            onClick={() => {
              soundEngine.playChime("click");
              setSelectedCategory("All");
            }}
            className={`px-3 py-1 border-2 border-black font-black text-xs uppercase whitespace-nowrap transition-all ${
              selectedCategory === "All"
                ? "bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                : "bg-white text-black hover:bg-gray-100 shadow-[1px_1px_0px_#000]"
            }`}
          >
            All Docs ({documents.length})
          </button>
          {CATEGORIES.map((cat) => {
            const count = documents.filter((d) => d.category === cat).length;
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => {
                  soundEngine.playChime("click");
                  setSelectedCategory(cat);
                }}
                className={`px-3 py-1 border-2 border-black font-black text-xs uppercase whitespace-nowrap transition-all ${
                  isSelected
                    ? "shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] translate-x-[-1px] translate-y-[-1px]"
                    : "hover:opacity-80 shadow-[1px_1px_0px_#000]"
                }`}
                style={{
                  backgroundColor: isSelected ? CATEGORY_COLORS[cat].bg : "#FFFFFF",
                  color: isSelected ? CATEGORY_COLORS[cat].text : "#000000",
                }}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Document Grid / List Area */}
      {filteredDocuments.length === 0 ? (
        <div className="bg-white border-2 border-black p-8 sm:p-12 text-center shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] max-w-xl mx-auto">
          <div className="w-16 h-16 bg-[#FFE600] border-2 border-black flex items-center justify-center mx-auto mb-4 shadow-[3px_3px_0px_#000]">
            <FolderLock className="w-8 h-8 text-black" />
          </div>
          <h3 className="text-xl font-black text-black mb-1">No Documents Found</h3>
          <p className="text-xs sm:text-sm font-bold text-gray-600 mb-6">
            {searchQuery || selectedCategory !== "All" || selectedCourseTag !== "All"
              ? "No documents match your filter criteria. Try clearing search filters."
              : "Your document vault is currently empty. Upload your first syllabus, lecture slide, or textbook to get started!"}
          </p>
          <button
            onClick={() => {
              soundEngine.playChime("click");
              setIsUploadDrawerOpen(true);
            }}
            className="px-5 py-2.5 bg-[#00F0FF] hover:bg-[#6df6ff] border-2 border-black font-black text-xs uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          >
            Upload Study Document
          </button>
        </div>
      ) : viewMode === "grid" ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredDocuments.map((doc) => (
            <div
              key={doc.id}
              className={`bg-white border-2 border-black flex flex-col justify-between transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] ${
                doc.pinned
                  ? "shadow-[5px_5px_0px_0px_rgba(255,102,196,1)] border-black"
                  : "shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              }`}
            >
              {/* Card Header */}
              <div className="p-4 border-b-2 border-black/10">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 border border-black text-[10px] font-black uppercase shadow-[1px_1px_0px_#000]"
                      style={{
                        backgroundColor: CATEGORY_COLORS[doc.category]?.bg || "#FFE600",
                        color: CATEGORY_COLORS[doc.category]?.text || "#000",
                      }}
                    >
                      {doc.category}
                    </span>
                    {doc.courseTag && (
                      <span className="px-2 py-0.5 border border-black bg-[#E2E8F0] text-black text-[10px] font-black shadow-[1px_1px_0px_#000]">
                        {doc.courseTag}
                      </span>
                    )}
                  </div>

                  {/* Pin button */}
                  <button
                    onClick={() => {
                      soundEngine.playChime("click");
                      onTogglePinDocument(doc.id, !doc.pinned);
                    }}
                    title={doc.pinned ? "Unpin document" : "Pin document to top"}
                    className={`p-1 border border-black transition-colors ${
                      doc.pinned
                        ? "bg-[#FF66C4] text-black"
                        : "bg-white text-gray-400 hover:text-black hover:bg-gray-100"
                    }`}
                  >
                    <Pin className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Document Title & Icon */}
                <div className="flex items-start gap-2.5 mt-2">
                  <div className="p-2 bg-[#F4F4F0] border-2 border-black flex-shrink-0 mt-0.5">
                    {isPdf(doc) ? (
                      <FileText className="w-5 h-5 text-[#FF4B4B]" />
                    ) : isImage(doc) ? (
                      <ImageIcon className="w-5 h-5 text-[#00F0FF]" />
                    ) : (
                      <FileCode className="w-5 h-5 text-[#FFA94D]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3
                      onClick={() => {
                        soundEngine.playChime("click");
                        setSelectedDocForViewer(doc);
                      }}
                      className="font-black text-sm sm:text-base text-black hover:text-[#00F0FF] cursor-pointer line-clamp-2 leading-snug tracking-tight"
                      title={doc.title}
                    >
                      {doc.title}
                    </h3>
                    <p className="text-[11px] text-gray-500 font-bold truncate mt-0.5">
                      {doc.fileName}
                    </p>
                  </div>
                </div>
              </div>

              {/* Card Meta & Actions Footer */}
              <div className="p-3 bg-[#F9F9F6] border-t-2 border-black flex items-center justify-between gap-2">
                <span className="text-[10px] font-black text-gray-600">
                  {formatFileSize(doc.fileSize)} •{" "}
                  {new Date(doc.uploadedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>

                <div className="flex items-center gap-1.5">
                  {/* Open Reader Button */}
                  <button
                    onClick={() => {
                      soundEngine.playChime("click");
                      setSelectedDocForViewer(doc);
                    }}
                    className="px-2.5 py-1 bg-[#FFE600] hover:bg-[#fff04d] border-2 border-black font-black text-xs uppercase shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-1 cursor-pointer"
                    title="Read document inside StudiSpace viewer"
                  >
                    <Eye className="w-3.5 h-3.5 text-black" />
                    <span>Read</span>
                  </button>

                  {/* Ask Socrates AI */}
                  {onAskSocrates && (
                    <button
                      onClick={() => {
                        soundEngine.playChime("click");
                        onAskSocrates(
                          doc.title,
                          `Analyzing academic document: ${doc.title} (${doc.courseTag || "Subject"})`
                        );
                      }}
                      className="p-1 bg-white hover:bg-[#00F0FF] border-2 border-black shadow-[1px_1px_0px_#000] active:translate-x-0.5 active:translate-y-0.5"
                      title="Ask Socrates AI about this doc"
                    >
                      <Brain className="w-3.5 h-3.5 text-black" />
                    </button>
                  )}

                  {/* Delete Button */}
                  <button
                    onClick={() => setDocToDelete(doc)}
                    className="p-1 bg-white hover:bg-[#FF4B4B] hover:text-white border-2 border-black text-gray-600 transition-colors shadow-[1px_1px_0px_#000] active:translate-x-0.5 active:translate-y-0.5"
                    title="Delete document"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] divide-y-2 divide-black">
          {filteredDocuments.map((doc) => (
            <div
              key={doc.id}
              className={`p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FFFDE6] transition-colors ${
                doc.pinned ? "bg-[#FFF9F9]" : ""
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-[#F4F4F0] border-2 border-black flex-shrink-0">
                  {isPdf(doc) ? (
                    <FileText className="w-5 h-5 text-[#FF4B4B]" />
                  ) : isImage(doc) ? (
                    <ImageIcon className="w-5 h-5 text-[#00F0FF]" />
                  ) : (
                    <FileCode className="w-5 h-5 text-[#FFA94D]" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span
                      onClick={() => {
                        soundEngine.playChime("click");
                        setSelectedDocForViewer(doc);
                      }}
                      className="font-black text-sm sm:text-base text-black hover:text-[#00F0FF] cursor-pointer truncate max-w-md"
                    >
                      {doc.title}
                    </span>
                    <span
                      className="px-1.5 py-0.5 border border-black text-[9px] font-black uppercase"
                      style={{
                        backgroundColor: CATEGORY_COLORS[doc.category]?.bg || "#FFE600",
                        color: CATEGORY_COLORS[doc.category]?.text || "#000",
                      }}
                    >
                      {doc.category}
                    </span>
                    {doc.courseTag && (
                      <span className="px-1.5 py-0.5 border border-black bg-gray-100 text-[9px] font-black">
                        {doc.courseTag}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 font-bold truncate">
                    {doc.fileName} • {formatFileSize(doc.fileSize)} • Uploaded{" "}
                    {new Date(doc.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 ml-auto flex-shrink-0">
                <button
                  onClick={() => {
                    soundEngine.playChime("click");
                    onTogglePinDocument(doc.id, !doc.pinned);
                  }}
                  className={`p-1.5 border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] ${
                    doc.pinned ? "bg-[#FF66C4]" : "bg-white hover:bg-gray-100"
                  }`}
                  title={doc.pinned ? "Unpin" : "Pin"}
                >
                  <Pin className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => {
                    soundEngine.playChime("click");
                    setSelectedDocForViewer(doc);
                  }}
                  className="px-3 py-1.5 bg-[#FFE600] hover:bg-[#fff04d] border-2 border-black font-black text-xs uppercase shadow-[2px_2px_0px_#000] flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5 text-black" />
                  <span>Read</span>
                </button>

                {onAskSocrates && (
                  <button
                    onClick={() => {
                      soundEngine.playChime("click");
                      onAskSocrates(
                        doc.title,
                        `Context from document: ${doc.title} (${doc.courseTag || "General"})`
                      );
                    }}
                    className="p-1.5 bg-white hover:bg-[#00F0FF] border-2 border-black shadow-[2px_2px_0px_#000]"
                    title="Ask Socrates AI"
                  >
                    <Brain className="w-3.5 h-3.5 text-black" />
                  </button>
                )}

                <button
                  onClick={() => setDocToDelete(doc)}
                  className="p-1.5 bg-white hover:bg-[#FF4B4B] hover:text-white border-2 border-black shadow-[2px_2px_0px_#000]"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Document Modal / Drawer */}
      {isUploadDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white border-2 border-black w-full max-w-lg shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-[#00F0FF] border-b-2 border-black px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-black" />
                <h2 className="font-black text-base sm:text-lg text-black tracking-tight">
                  Upload to Document Vault
                </h2>
              </div>
              <button
                onClick={() => {
                  soundEngine.playChime("click");
                  setIsUploadDrawerOpen(false);
                }}
                className="p-1 bg-white hover:bg-[#FF4B4B] hover:text-white border-2 border-black font-black text-xs"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Upload Form */}
            <form onSubmit={handleUploadSubmit} className="p-4 sm:p-6 space-y-4">
              {/* Drag and drop zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
                  isDragOver
                    ? "bg-[#FFFDE6] border-[#00F0FF]"
                    : uploadFile
                    ? "bg-[#F0FFF4] border-[#73EC8E]"
                    : "bg-[#F9F9F6] border-black hover:bg-[#FFFDE6]"
                }`}
              >
                <input
                  ref={fileInputRef}
                  id="input-vault-file"
                  type="file"
                  accept={ACCEPTED_FILE_INPUT}
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {uploadFile ? (
                  <div className="space-y-1">
                    <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto" />
                    <p className="font-black text-sm text-black">{uploadFile.name}</p>
                    <p className="text-xs font-bold text-gray-500">
                      {formatFileSize(uploadFile.size)} • Click to change file
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <UploadCloud className="w-8 h-8 text-gray-500 mx-auto" />
                    <p className="font-black text-sm text-black">
                      Drag & drop your PDF, Image, or Doc here
                    </p>
                    <p className="text-xs font-bold text-gray-500">
                      Supports PDF, PNG, JPG, JPEG (Max 50 MB)
                    </p>
                  </div>
                )}
              </div>

              {/* Title Field */}
              <div>
                <label className="block text-xs font-black uppercase text-black mb-1">
                  Document Title *
                </label>
                <input
                  type="text"
                  required
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g., AVL Tree Rotation Proofs & Code"
                  className="w-full px-3 py-2 border-2 border-black font-bold text-xs sm:text-sm focus:bg-[#FFFDE6] focus:outline-none shadow-[2px_2px_0px_#000]"
                />
              </div>

              {/* Category & Course Tag Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Category Selection */}
                <div>
                  <label className="block text-xs font-black uppercase text-black mb-1">
                    Category *
                  </label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value as DocumentCategory)}
                    className="w-full px-3 py-2 border-2 border-black font-black text-xs bg-white shadow-[2px_2px_0px_#000] focus:outline-none cursor-pointer"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Course Code / Tag */}
                <div>
                  <label className="block text-xs font-black uppercase text-black mb-1">
                    Course / Subject Tag
                  </label>
                  <input
                    type="text"
                    value={uploadCourseTag}
                    onChange={(e) => setUploadCourseTag(e.target.value)}
                    placeholder="e.g., CS 201, MATH 240"
                    list="course-tag-suggestions"
                    className="w-full px-3 py-2 border-2 border-black font-bold text-xs sm:text-sm focus:bg-[#FFFDE6] focus:outline-none shadow-[2px_2px_0px_#000]"
                  />
                  <datalist id="course-tag-suggestions">
                    {allCourseTags.map((tag) => (
                      <option key={tag} value={tag} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Progress Bar (During Upload) */}
              {isUploading && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between text-xs font-black">
                    <span>Uploading to Secure Vault...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-3 bg-gray-200 border-2 border-black overflow-hidden">
                    <div
                      className="h-full bg-[#00F0FF] border-r border-black transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {uploadError && (
                <p className="text-xs font-black text-[#FF4B4B] bg-[#FFF0F0] p-2 border border-[#FF4B4B]">
                  ⚠️ {uploadError}
                </p>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-black">
                <button
                  type="button"
                  id="btn-vault-cancel-upload"
                  disabled={isUploading}
                  onClick={() => setIsUploadDrawerOpen(false)}
                  className="px-4 py-2 bg-white hover:bg-gray-100 border-2 border-black font-black text-xs uppercase shadow-[2px_2px_0px_#000]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-vault-save-document"
                  disabled={isUploading || !uploadFile}
                  className="px-5 py-2 bg-[#FFE600] hover:bg-[#fff04d] disabled:opacity-50 border-2 border-black font-black text-xs uppercase shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-1.5 cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4 text-black" />
                  <span>{isUploading ? "Uploading..." : "Save to Vault"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {docToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white border-2 border-black p-6 max-w-sm w-full shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-center">
            <div className="w-12 h-12 bg-[#FF4B4B] border-2 border-black flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-black text-lg text-black mb-1">Delete Document?</h3>
            <p className="text-xs text-gray-600 font-bold mb-4">
              Are you sure you want to remove <span className="text-black font-black">"{docToDelete.title}"</span> from your study vault? This action cannot be undone.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setDocToDelete(null)}
                className="px-4 py-2 bg-white hover:bg-gray-100 border-2 border-black font-black text-xs uppercase shadow-[2px_2px_0px_#000]"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirmed}
                className="px-4 py-2 bg-[#FF4B4B] hover:bg-[#ff6868] text-white border-2 border-black font-black text-xs uppercase shadow-[2px_2px_0px_#000]"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full In-App Document Viewer Modal */}
      <DocumentViewerModal
        document={selectedDocForViewer}
        isOpen={Boolean(selectedDocForViewer)}
        onClose={() => setSelectedDocForViewer(null)}
        onAskSocrates={onAskSocrates}
        onCreateFlashcards={onCreateFlashcards}
      />
    </div>
  );
};
