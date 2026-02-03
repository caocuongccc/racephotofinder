// components/connect-google-drive.tsx
"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Cloud, CheckCircle, AlertCircle } from "lucide-react";
import { useSession } from "next-auth/react";

export function ConnectGoogleDrive() {
  const { data: session, update } = useSession();
  const [connecting, setConnecting] = useState(false);

  const isConnected = !!(session?.user as any)?.googleAccessToken;

  const handleConnect = () => {
    setConnecting(true);
    window.location.href = "/api/auth/google";
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect Google Drive?")) return;

    try {
      await fetch("/api/auth/google/disconnect", { method: "POST" });
      await update(); // Refresh session
      window.location.reload();
    } catch (error) {
      console.error("Disconnect error:", error);
    }
  };

  if (isConnected) {
    return (
      <div className="flex items-center space-x-2 p-4 bg-green-50 border border-green-200 rounded-lg">
        <CheckCircle className="h-5 w-5 text-green-600" />
        <div className="flex-1">
          <p className="text-sm font-medium text-green-900">
            Google Drive Connected
          </p>
          <p className="text-xs text-green-700">
            Photos will be uploaded to your Google Drive
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={handleDisconnect}>
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-start space-x-3">
        <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-900">
            Connect Google Drive
          </p>
          <p className="text-sm text-blue-700 mt-1">
            Connect your Google account to upload photos to your Google Drive.
          </p>
          <Button
            size="sm"
            onClick={handleConnect}
            loading={connecting}
            className="mt-3"
          >
            <Cloud className="h-4 w-4 mr-2" />
            Connect Google Drive
          </Button>
        </div>
      </div>
    </div>
  );
}
