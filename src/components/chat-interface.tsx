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
import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  DefaultChatTransport,
  type ToolUIPart,
  type UIToolInvocation,
  type UITool,
} from "ai";
import { useChat } from "@ai-sdk/react";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolOutput,
  ToolInput,
} from "@/components/ai-elements/tool";

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
}: {
  fileChat?: boolean;
  fileId?: string;
}) => {
  const { messages, sendMessage, status } = useChat(
    fileChat
      ? {
          transport: new DefaultChatTransport({
            api: `${process.env.NEXT_PUBLIC_API_URL}/api/files/${fileId}/answer`,
            credentials: "include",
          }),
        }
      : {
          transport: new DefaultChatTransport({
            api: `${process.env.NEXT_PUBLIC_API_URL}/api/agents/general`,
            credentials: "include",
          }),
        }
  );
  const [model, setModel] = useState<string>(models[0].id);
  const [text, setText] = useState<string>("");
  const [useWebSearch, setUseWebSearch] = useState<boolean>(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const addUserMessage = useCallback(
    (content: string) => {
      sendMessage({
        text: content,
      });
    },
    [sendMessage]
  );

  const handleSubmit = (message: PromptInputMessage) => {
    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);

    if (!(hasText || hasAttachments)) {
      return;
    }

    if (message.files?.length) {
      toast.success("Files attached", {
        description: `${message.files.length} file(s) attached to message`,
      });
    }

    addUserMessage(message.text || "Sent with attachments");
    setText("");
  };

  // const handleSuggestionClick = (suggestion: string) => {
  //   setStatus("submitted");
  //   addUserMessage(suggestion);
  // };

  return (
    <div className="relative flex size-full flex-col divide-y overflow-hidden max-w-3xl mx-auto">
      <Conversation>
        <ConversationContent>
          {messages.map((message) => (
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
          ))}
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
