"use client";

import { removeOrder } from "@/components/actions/orders-action";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface OrderDeleteButtonProps {
  orderId: string;
}

export function OrderDeleteButton({ orderId }: OrderDeleteButtonProps) {
  const handleDelete = async () => {
    await removeOrder(orderId);
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
