import { SidebarTrigger } from "@/components/ui/sidebar";
import { MessageSquare } from "lucide-react";

export default function ChatPage() {
  return (
    <div className="flex flex-col h-full">
       <div className="flex items-center gap-2 p-4 border-b md:hidden">
        <SidebarTrigger />
        <h2 className="text-xl font-semibold font-headline">Chats</h2>
      </div>
      <div className="flex flex-1 items-center justify-center bg-muted/30">
        <div className="text-center">
          <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-2xl font-headline font-semibold">
            Select a Chat
          </h2>
          <p className="mt-2 text-muted-foreground">
            Choose a conversation from the sidebar to start messaging.
          </p>
        </div>
      </div>
    </div>
  );
}
