// "use client";

// import { useState, useEffect, useRef } from "react";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { ScrollArea } from "@/components/ui/scroll-area";
// import { Send, FileText, Sparkles, Plus } from "lucide-react";
// import { useChat } from "ai/react";

// type Message = {
//   id: string;
//   chatId: string;
//   role: "user" | "assistant";
//   content: string;
//   createdAt: number;
// };

// type ChatInterfaceProps = {
//   selectedFolderId: string | null;
//   onUploadClick: () => void;
// };

// export function ChatInterface({
//   selectedFolderId,
//   onUploadClick,
// }: ChatInterfaceProps) {
//   const [currentChatId, setCurrentChatId] = useState<string | null>(null);
//   const [chats, setChats] = useState<any[]>([]);
//   const [messages, setMessages] = useState<Message[]>([]);
//   const scrollRef = useRef<HTMLDivElement>(null);

//   const {
//     messages: streamMessages,
//     input,
//     handleInputChange,
//     handleSubmit,
//     isLoading,
//   } = useChat({
//     api: currentChatId ? `/api/chats/${currentChatId}/messages` : undefined,
//     onFinish: () => {
//       if (currentChatId) {
//         loadMessages(currentChatId);
//       }
//     },
//   });

//   useEffect(() => {
//     loadChats();
//   }, [selectedFolderId]);

//   useEffect(() => {
//     if (scrollRef.current) {
//       scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
//     }
//   }, [messages, streamMessages]);

//   const loadChats = async () => {
//     try {
//       const response = await fetch("/api/chats");
//       const data = await response.json();
//       setChats(data);
//     } catch (error) {
//       console.error("Error loading chats:", error);
//     }
//   };

//   const loadMessages = async (chatId: string) => {
//     try {
//       const response = await fetch(`/api/chats/${chatId}`);
//       const data = await response.json();
//       setMessages(data.messages || []);
//     } catch (error) {
//       console.error("Error loading messages:", error);
//     }
//   };

//   const createNewChat = async () => {
//     try {
//       const response = await fetch("/api/chats", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           title: "New Chat",
//           folderId: selectedFolderId,
//         }),
//       });

//       if (response.ok) {
//         const newChat = await response.json();
//         setCurrentChatId(newChat.id);
//         setMessages([]);
//         loadChats();
//       }
//     } catch (error) {
//       console.error("Error creating chat:", error);
//     }
//   };

//   const selectChat = (chatId: string) => {
//     setCurrentChatId(chatId);
//     loadMessages(chatId);
//   };

//   const allMessages = currentChatId
//     ? [
//         ...messages,
//         ...streamMessages.filter(
//           (m) => !messages.find((msg) => msg.id === m.id)
//         ),
//       ]
//     : [];

//   return (
//     <div className="flex-1 flex flex-col h-screen">
//       {/* Header */}
//       <div className="border-b p-4 flex items-center justify-between">
//         <div>
//           <h1 className="text-xl font-semibold">
//             {selectedFolderId ? "Chat with Folder" : "Chat with All Documents"}
//           </h1>
//           <p className="text-sm text-muted-foreground">
//             Ask questions about your documents
//           </p>
//         </div>
//         <div className="flex gap-2">
//           <Button variant="outline" onClick={onUploadClick}>
//             <FileText className="h-4 w-4 mr-2" />
//             Upload
//           </Button>
//           <Button onClick={createNewChat}>
//             <Plus className="h-4 w-4 mr-2" />
//             New Chat
//           </Button>
//         </div>
//       </div>

//       {/* Messages Area */}
//       <ScrollArea className="flex-1 p-4" ref={scrollRef}>
//         {!currentChatId ? (
//           <div className="flex flex-col items-center justify-center h-full text-center">
//             <Sparkles className="h-16 w-16 text-muted-foreground mb-4" />
//             <h2 className="text-2xl font-semibold mb-2">
//               Welcome to Document Chat
//             </h2>
//             <p className="text-muted-foreground mb-6 max-w-md">
//               Start a new chat to ask questions about your documents. The AI
//               will use your uploaded documents to provide accurate answers.
//             </p>
//             <Button onClick={createNewChat} size="lg">
//               <Plus className="h-5 w-5 mr-2" />
//               Start New Chat
//             </Button>
//           </div>
//         ) : allMessages.length === 0 ? (
//           <div className="flex flex-col items-center justify-center h-full text-center">
//             <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
//             <p className="text-muted-foreground">
//               Ask a question about your documents to get started
//             </p>
//           </div>
//         ) : (
//           <div className="space-y-4 max-w-4xl mx-auto">
//             {allMessages.map((message, index) => (
//               <div
//                 key={message.id || index}
//                 className={`flex ${
//                   message.role === "user" ? "justify-end" : "justify-start"
//                 }`}
//               >
//                 <div
//                   className={`max-w-[80%] rounded-lg p-4 ${
//                     message.role === "user"
//                       ? "bg-primary text-primary-foreground"
//                       : "bg-muted"
//                   }`}
//                 >
//                   <p className="whitespace-pre-wrap">{message.content}</p>
//                 </div>
//               </div>
//             ))}
//           </div>
//         )}
//       </ScrollArea>

//       {/* Input Area */}
//       {currentChatId && (
//         <div className="border-t p-4">
//           <form
//             onSubmit={handleSubmit}
//             className="max-w-4xl mx-auto flex gap-2"
//           >
//             <Input
//               value={input}
//               onChange={handleInputChange}
//               placeholder="Ask a question about your documents..."
//               disabled={isLoading}
//               className="flex-1"
//             />
//             <Button type="submit" disabled={isLoading || !input.trim()}>
//               <Send className="h-4 w-4" />
//             </Button>
//           </form>
//         </div>
//       )}
//     </div>
//   );
// }
