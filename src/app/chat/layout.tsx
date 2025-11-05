'use client';

import { Sidebar, SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { ChatList } from "@/components/chat/chat-list";
import { getChats } from "@/lib/data";
import { useIsMobile } from "@/hooks/use-mobile";

export default function ChatAppLayout({ children }: { children: React.ReactNode }) {
  const chats = getChats();
  const isMobile = useIsMobile();
  
  return (
    <SidebarProvider>
      <div className="h-screen w-full flex bg-background">
        <Sidebar collapsible="icon" side="left" className="p-0" defaultOpen={!isMobile}>
          <ChatList chats={chats} />
        </Sidebar>
        <main className="flex-1 flex flex-col h-screen">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
