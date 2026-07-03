"use client";

import { removeCourier } from "@/components/actions/couriers-action";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface CourierDeleteButtonProps {
  courierId: string;
}

export function CourierDeleteButton({ courierId }: CourierDeleteButtonProps) {
  const handleDelete = async () => {
    await removeCourier(courierId);
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
