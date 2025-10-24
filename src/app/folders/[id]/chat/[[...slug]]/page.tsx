"use client";

import { useState, useEffect, use } from "react";
import ChatInterface from "@/components/chat-interface";
import { ChatHistory } from "@/components/chat-history";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MessageSquare, History } from "lucide-react";

interface ChatPageProps {
  params: Promise<{ slug: string[] | undefined; id: string }>;
}

export default function ChatPage({ params }: ChatPageProps) {
  const { slug, id } = use(params);
  const folderId = id;

  const [threadId, setThreadId] = useState<string | undefined>(slug?.[0]);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);

  // Update threadId when slug changes
  useEffect(() => {
    setThreadId(slug?.[0]);
  }, [slug]);

  const handleNewChat = () => {
    setThreadId(undefined);
  };

  if (!folderId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="px-4 py-2 border-b">
        <div className="flex items-center gap-3">
          <SidebarTrigger />
          <h2 className="text-lg font-semibold transition-all">Chats</h2>

          <div className="flex-1" />

          {/* Action Buttons */}
          <Dialog
            open={isHistoryDialogOpen}
            onOpenChange={setIsHistoryDialogOpen}
          >
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <History className="h-4 w-4 mr-2" />
                History
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Chat History</DialogTitle>
              </DialogHeader>
              <div className="max-h-96 overflow-y-auto">
                {folderId && (
                  <ChatHistory
                    folderId={folderId}
                    currentThreadId={threadId}
                    onChatSelect={(selectedThreadId) => {
                      setThreadId(selectedThreadId);
                      setIsHistoryDialogOpen(false);
                    }}
                    onNewChat={() => {
                      setThreadId(undefined);
                      setIsHistoryDialogOpen(false);
                    }}
                    isVisible={true}
                    onToggle={() => {}}
                  />
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Button onClick={handleNewChat} size="sm">
            <MessageSquare className="h-4 w-4 mr-2" />
            New Chat
          </Button>
        </div>
      </div>
      <div className="flex gap-4 p-4 h-full">
        <div className="min-w-0 flex-1 h-[calc(100vh-64px)]">
          <ChatInterface
            threadId={threadId}
            folderId={folderId}
            onThreadIdChange={setThreadId}
          />
        </div>
      </div>
    </div>
  );
}
