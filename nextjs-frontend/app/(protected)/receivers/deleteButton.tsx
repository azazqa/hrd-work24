"use client";

import { removeReceiver } from "@/components/actions/receivers-action";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface ReceiverDeleteButtonProps {
  receiverId: string;
}

export function ReceiverDeleteButton({
  receiverId,
}: ReceiverDeleteButtonProps) {
  const handleDelete = async () => {
    await removeReceiver(receiverId);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="text-muted-foreground hover:text-red-600 hover:bg-accent"
      onClick={handleDelete}
      title="삭제"
    >
      <Trash2 className="w-4 h-4" />
    </Button>
  );
}
