"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Trash2, MessageSquare, Clock } from "lucide-react";
import { workerRequest } from "@/lib/worker";
import { toast } from "sonner";

type Chat = {
  id: string;
  title: string;
  folderId: string | null;
  createdAt: number;
  updatedAt: number;
};

type ChatHistoryProps = {
  folderId?: string;
  currentThreadId?: string;
  onChatSelect: (threadId: string) => void;
  onNewChat: () => void;
  isVisible: boolean;
  onToggle: () => void;
};

export function ChatHistory({
  folderId,
  currentThreadId,
  onChatSelect,
  onNewChat,
  isVisible,
  onToggle,
}: ChatHistoryProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(false);

  const loadChats = async () => {
    setLoading(true);
    try {
      const allChats = await workerRequest<Chat[]>("/api/chats");
      // Filter chats by folderId if provided
      const filteredChats = folderId
        ? allChats.filter((chat) => chat.folderId === folderId)
        : allChats;
      setChats(filteredChats);
    } catch (error) {
      console.error("Failed to load chats:", error);
      toast.error("Failed to load chat history");
    } finally {
      setLoading(false);
    }
  };

  const deleteChat = async (chatId: string) => {
    try {
      await workerRequest(`/api/chats/${chatId}`, {
        method: "DELETE",
      });
      setChats((prev) => prev.filter((chat) => chat.id !== chatId));
      toast.success("Chat deleted");
    } catch (error) {
      console.error("Failed to delete chat:", error);
      toast.error("Failed to delete chat");
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  useEffect(() => {
    if (isVisible) {
      loadChats();
    }
  }, [isVisible, folderId]);

  if (!isVisible) {
    return (
      <Button variant="outline" size="sm" onClick={onToggle} className="mb-4">
        <MessageSquare className="h-4 w-4 mr-2" />
        Show Chat History
      </Button>
    );
  }

  return (
    <Card className="w-80 h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Chat History</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onNewChat}>
              New Chat
            </Button>
            <Button variant="ghost" size="sm" onClick={onToggle}>
              Hide
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-200px)]">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : chats.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-2">No chats yet</p>
              <p className="text-xs text-muted-foreground">
                Start a conversation to see your chat history here
              </p>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  className={`group relative p-3 rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                    currentThreadId === chat.id ? "bg-muted" : ""
                  }`}
                  onClick={() => onChatSelect(chat.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium truncate">
                        {chat.title || "Untitled Chat"}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDate(chat.updatedAt)}
                        </div>
                        {!folderId && chat.folderId && (
                          <Badge variant="secondary" className="text-xs">
                            Folder Chat
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteChat(chat.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
