// This page is no longer used for displaying individual chats in this layout.
// The logic has been moved to a component within the main chat page.
// You can delete this file if the new layout is approved.
export default function ChatIdPage({ params }: { params: { chatId: string } }) {
  return (
    <div className="flex h-screen items-center justify-center">
      Select a chat to view the conversation.
    </div>
  );
}
