"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Upload,
  X,
  CheckCircle,
  AlertCircle,
  Image as ImageIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { formatFileSize } from "@/lib/utils";
import { ConnectGoogleDrive } from "@/components/connect-google-drive";

interface Event {
  id: string;
  name: string;
  slug: string;
}

interface UploadFile {
  id: string;
  file: File;
  status: "pending" | "uploading" | "processing" | "completed" | "error";
  progress: number;
  photoId?: string;
  error?: string;
  autoDetected?: boolean; // NEW: Auto-detection flag
}

export default function UploadPage() {
  const { data: session } = useSession();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await fetch("/api/events?active=true");
      const data = await response.json();
      setEvents(data);
    } catch (error) {
      toast.error("Không thể tải danh sách sự kiện");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const maxSize = 10 * 1024 * 1024; // 10MB

    const validFiles = selectedFiles.filter((file) => {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} không phải là file ảnh`);
        return false;
      }
      if (file.size > maxSize) {
        toast.error(`${file.name} vượt quá 10MB`);
        return false;
      }
      return true;
    });

    const newFiles: UploadFile[] = validFiles.map((file) => ({
      id: Math.random().toString(36).substring(7),
      file,
      status: "pending",
      progress: 0,
    }));

    setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const uploadFiles = async () => {
    if (!selectedEventId) {
      toast.error("Vui lòng chọn sự kiện");
      return;
    }

    setUploading(true);

    for (const fileItem of files) {
      if (fileItem.status === "completed") continue;

      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          // Update status to uploading
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileItem.id
                ? { ...f, status: "uploading", progress: 0, error: undefined }
                : f,
            ),
          );

          // Step 1: Create photo record
          const urlResponse = await fetch("/api/photos/upload-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventId: selectedEventId,
              filename: fileItem.file.name,
              contentType: fileItem.file.type,
            }),
          });

          if (!urlResponse.ok) {
            const errorData = await urlResponse.json();
            throw new Error(errorData.error || "Failed to create photo record");
          }

          const { photoId } = await urlResponse.json();
          console.log("✅ Photo record created:", photoId);

          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileItem.id ? { ...f, progress: 20, photoId } : f,
            ),
          );

          // Step 2: Upload file
          const formData = new FormData();
          formData.append("file", fileItem.file);

          const uploadResponse = await fetch(`/api/photos/${photoId}/confirm`, {
            method: "POST",
            body: formData,
          });

          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            throw new Error(
              errorData.details || errorData.error || "Upload failed",
            );
          }

          const uploadData = await uploadResponse.json();
          console.log("✅ Upload successful:", uploadData);

          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileItem.id
                ? {
                    ...f,
                    status: "completed",
                    progress: 100,
                    photoId,
                    autoDetected: uploadData.photo?.isProcessed,
                  }
                : f,
            ),
          );

          // Success - break retry loop
          break;
        } catch (error: any) {
          retryCount++;
          console.error(`Upload attempt ${retryCount} failed:`, error);

          if (retryCount >= maxRetries) {
            // Final failure
            setFiles((prev) =>
              prev.map((f) =>
                f.id === fileItem.id
                  ? {
                      ...f,
                      status: "error",
                      error: `Upload failed after ${maxRetries} attempts: ${error.message}`,
                    }
                  : f,
              ),
            );
          } else {
            // Wait before retry
            await new Promise((resolve) =>
              setTimeout(resolve, 1000 * retryCount),
            );
            toast(`Retrying upload (${retryCount}/${maxRetries})...`);
          }
        }
      }
    }

    setUploading(false);

    const successCount = files.filter((f) => f.status === "completed").length;
    const failCount = files.filter((f) => f.status === "error").length;

    if (successCount > 0) {
      toast.success(
        `Upload hoàn tất: ${successCount} ảnh thành công${failCount > 0 ? `, ${failCount} thất bại` : ""}`,
      );
    } else {
      toast.error("Tất cả upload đều thất bại");
    }
  };

  const completedCount = files.filter((f) => f.status === "completed").length;
  const errorCount = files.filter((f) => f.status === "error").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Upload ảnh</h1>
        <p className="text-gray-600 mt-1">Upload ảnh vào sự kiện</p>
      </div>
      {/* Google Drive Connection Status */}
      <ConnectGoogleDrive />
      <Card>
        <CardHeader>
          <CardTitle>Chọn sự kiện</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={uploading}
          >
            <option value="">-- Chọn sự kiện --</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chọn ảnh</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer"
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <input
              id="file-input"
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              disabled={uploading}
            />
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">
              Click để chọn ảnh hoặc kéo thả vào đây
            </p>
            <p className="text-xs text-gray-500 mt-1">
              PNG, JPG, WEBP (Max 10MB)
            </p>
          </div>

          {files.length > 0 && (
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900">
                  {files.length} ảnh đã chọn
                </h3>
                <div className="text-sm text-gray-600">
                  <span className="text-green-600">
                    {completedCount} hoàn tất
                  </span>
                  {errorCount > 0 && (
                    <span className="text-red-600 ml-2">{errorCount} lỗi</span>
                  )}
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {files.map((fileItem) => (
                  <div
                    key={fileItem.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3 flex-1">
                      <ImageIcon className="h-5 w-5 text-gray-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {fileItem.file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(fileItem.file.size)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {fileItem.status === "completed" && (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      )}
                      {fileItem.status === "error" && (
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      )}
                      {(fileItem.status === "uploading" ||
                        fileItem.status === "processing") && (
                        <div className="flex items-center space-x-2">
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all"
                              style={{ width: `${fileItem.progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600">
                            {fileItem.progress}%
                          </span>
                        </div>
                      )}
                      {!uploading && fileItem.status === "pending" && (
                        <button
                          onClick={() => removeFile(fileItem.id)}
                          className="text-gray-400 hover:text-red-600"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <Button
                onClick={uploadFiles}
                disabled={
                  uploading ||
                  !selectedEventId ||
                  files.every((f) => f.status === "completed")
                }
                loading={uploading}
                className="w-full"
              >
                {uploading ? "Đang upload..." : "Upload tất cả"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
