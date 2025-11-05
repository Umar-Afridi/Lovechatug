import { ChatView } from "@/components/chat/chat-view";
import { getChatById } from "@/lib/data";
import { notFound } from "next/navigation";

export default function ChatIdPage({ params }: { params: { chatId: string } }) {
  const chat = getChatById(params.chatId);

  if (!chat) {
    notFound();
  }

  // The logged in user is hardcoded for this demo
  const loggedInUserId = "user1"; 

  return <ChatView chat={chat} loggedInUserId={loggedInUserId} />;
}
