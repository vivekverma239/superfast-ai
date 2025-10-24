"use client";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputButton,
  type PromptInputMessage,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
  PromptInputSpeechButton,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Response } from "@/components/ai-elements/response";

import { GlobeIcon } from "lucide-react";
import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import { DefaultChatTransport, type UIToolInvocation, type UITool } from "ai";
import { useChat } from "@ai-sdk/react";
import { workerRequest } from "@/lib/worker";
import { Button } from "@/components/ui/button";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolOutput,
  ToolInput,
} from "@/components/ai-elements/tool";
import { nanoid } from "nanoid";

const models = [
  { id: "gpt-4", name: "GPT-4" },
  { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
  { id: "claude-2", name: "Claude 2" },
  { id: "claude-instant", name: "Claude Instant" },
  { id: "palm-2", name: "PaLM 2" },
  { id: "llama-2-70b", name: "Llama 2 70B" },
  { id: "llama-2-13b", name: "Llama 2 13B" },
  { id: "cohere-command", name: "Command" },
  { id: "mistral-7b", name: "Mistral 7B" },
];

const ToolCall = ({
  type,
  part,
}: {
  type: `tool-${string}`;
  part: UIToolInvocation<UITool>;
}) => {
  const input = part.input as Record<string, unknown>;
  return (
    <Tool>
      <ToolHeader type={type} state={part.state} />
      <ToolContent>
        {input && <ToolInput input={input} />}
        {part.state === "output-available" && (
          <ToolOutput errorText={part.errorText} output={part.output} />
        )}
      </ToolContent>
    </Tool>
  );
};

const ChatInterface = ({
  fileChat,
  fileId,
  threadId,
  onThreadIdChange,
  folderId,
}: {
  fileChat?: boolean;
  fileId?: string;
  threadId?: string;
  onThreadIdChange?: (threadId: string) => void;
  folderId?: string;
}) => {
  const [currentThreadId, setCurrentThreadId] = useState<string | undefined>(
    undefined
  );
  const [model, setModel] = useState<string>(models[0].id);
  const [text, setText] = useState<string>("");
  const [useWebSearch, setUseWebSearch] = useState<boolean>(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const threadIdRef = useRef<string | undefined>(threadId);

  // Create a new thread if none exists
  const createNewThread = useCallback(async () => {
    try {
      const newChat = await workerRequest<{ id: string }>("/api/chats", {
        method: "POST",
        body: JSON.stringify({
          title: "New Chat",
          folderId: folderId || null,
        }),
      });
      const newThreadId = newChat.id;
      threadIdRef.current = newThreadId;
      setCurrentThreadId(newThreadId);
      console.log("newThreadId", newThreadId);
      onThreadIdChange?.(newThreadId);
      return newThreadId;
    } catch (error) {
      console.error("Failed to create new thread:", error);
      toast.error("Failed to create new chat");
      return null;
    }
  }, [folderId, onThreadIdChange]);

  // No longer auto-create threads on mount - only create when first message is sent

  const { messages, sendMessage, status, setMessages } = useChat(
    fileChat
      ? {
          generateId: () => nanoid().toString(),
          transport: new DefaultChatTransport({
            api: `${process.env.NEXT_PUBLIC_API_URL}/api/files/${fileId}/answer`,
            credentials: "include",
            body: () => ({
              threadId: threadIdRef.current,
              folderId: folderId,
            }),
          }),
        }
      : {
          transport: new DefaultChatTransport({
            api: `${process.env.NEXT_PUBLIC_API_URL}/api/agents/general`,
            credentials: "include",
            body: () => ({
              threadId: threadIdRef.current,
              folderId: folderId,
            }),
          }),
        }
  );

  // Load chat history from API
  const loadChatHistory = useCallback(
    async (chatThreadId: string) => {
      setIsLoadingMessages(true);
      try {
        const chatData = await workerRequest<{
          id: string;
          title: string;
          messages: Array<{
            id: string;
            message: unknown;
            createdAt: number;
          }>;
        }>(`/api/chats/${chatThreadId}`);

        // Convert stored messages to UI format and set them
        if (chatData.messages && chatData.messages.length > 0) {
          // Use the stored message data directly as it should already be in the correct format
          const uiMessages = chatData.messages
            .map((msg) => msg.message)
            .filter(Boolean);
          setMessages(uiMessages as unknown as typeof messages);
        } else {
          // Clear messages if no history found
          setMessages([]);
        }
      } catch (error) {
        console.error("Failed to load chat history:", error);
        toast.error("Failed to load chat history");
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [setMessages]
  );

  // Load existing chat when threadId changes
  useEffect(() => {
    if (threadId !== currentThreadId) {
      setCurrentThreadId(threadId);
      // Load existing chat messages
      if (threadId) {
        loadChatHistory(threadId);
      } else {
        setMessages([]);
      }
    }
  }, [threadId, currentThreadId, loadChatHistory]);

  // Load initial messages when component mounts with a threadId
  useEffect(() => {
    if (threadId && !currentThreadId) {
      setCurrentThreadId(threadId);
      threadIdRef.current = threadId;
      console.log("threadIdRef.current", threadIdRef.current);
      loadChatHistory(threadId);
    }
  }, [threadId, currentThreadId, loadChatHistory]);

  const addUserMessage = useCallback(
    (content: string) => {
      sendMessage({
        text: content,
      });
    },
    [sendMessage]
  );

  const handleSubmit = async (message: PromptInputMessage) => {
    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);

    if (!(hasText || hasAttachments)) {
      return;
    }

    // Create a new thread only when sending the first message (for non-file chats)
    if (!fileChat && !threadIdRef.current) {
      const newThreadId = await createNewThread();
      if (!newThreadId) {
        return; // Failed to create thread
      }
      // Update both ref and state immediately
      threadIdRef.current = newThreadId;
      setCurrentThreadId(newThreadId);
    }

    if (message.files?.length) {
      toast.success("Files attached", {
        description: `${message.files.length} file(s) attached to message`,
      });
    }

    addUserMessage(message.text || "Sent with attachments");
    setText("");
  };

  return (
    <div className="relative flex h-full flex-col divide-y overflow-y-auto max-w-3xl mx-auto">
      <Conversation className="relative size-full" style={{ height: "500px" }}>
        <ConversationContent>
          {isLoadingMessages ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading chat history...</p>
            </div>
          ) : messages.length === 0 && !currentThreadId ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <div className="text-4xl mb-4">💬</div>
              <h3 className="text-lg font-semibold mb-2">
                Start a conversation
              </h3>
              <p className="text-muted-foreground mb-4">
                Send a message to begin chatting with the AI assistant
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <Message from={message.role} key={message.id}>
                <MessageContent className="prose max-w-[80%]">
                  {message.parts.map((part, index) => (
                    <div key={`${message.id}-${index}`}>
                      {part.type === "text" ? (
                        <Response>{part.text}</Response>
                      ) : part.type == "reasoning" ? (
                        <Reasoning>
                          <ReasoningTrigger />
                          <ReasoningContent>{part.text}</ReasoningContent>
                        </Reasoning>
                      ) : part.type.startsWith("tool-") ? (
                        <ToolCall
                          type={part.type as `tool-${string}`}
                          part={part as UIToolInvocation<UITool>}
                        />
                      ) : null}
                    </div>
                  ))}
                </MessageContent>
              </Message>
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="grid shrink-0 gap-4 pt-4">
        <div className="w-full px-4 pb-4">
          <PromptInput globalDrop multiple onSubmit={handleSubmit}>
            <PromptInputBody>
              <PromptInputAttachments>
                {(attachment) => <PromptInputAttachment data={attachment} />}
              </PromptInputAttachments>
              <PromptInputTextarea
                onChange={(event) => setText(event.target.value)}
                ref={textareaRef}
                value={text}
              />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools>
                <PromptInputActionMenu>
                  <PromptInputActionMenuTrigger />
                  <PromptInputActionMenuContent>
                    <PromptInputActionAddAttachments />
                  </PromptInputActionMenuContent>
                </PromptInputActionMenu>
                <PromptInputSpeechButton
                  onTranscriptionChange={setText}
                  textareaRef={textareaRef}
                />
                <PromptInputButton
                  onClick={() => setUseWebSearch(!useWebSearch)}
                  variant={useWebSearch ? "default" : "ghost"}
                >
                  <GlobeIcon size={16} />
                  <span>Search</span>
                </PromptInputButton>
                <PromptInputModelSelect onValueChange={setModel} value={model}>
                  <PromptInputModelSelectTrigger>
                    <PromptInputModelSelectValue />
                  </PromptInputModelSelectTrigger>
                  <PromptInputModelSelectContent>
                    {models.map((model) => (
                      <PromptInputModelSelectItem
                        key={model.id}
                        value={model.id}
                      >
                        {model.name}
                      </PromptInputModelSelectItem>
                    ))}
                  </PromptInputModelSelectContent>
                </PromptInputModelSelect>
              </PromptInputTools>
              <PromptInputSubmit
                disabled={!text.trim() && status === "streaming"}
                status={status}
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
