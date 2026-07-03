"use client";

import { removeCategory } from "@/components/actions/categories-action";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface CategoryDeleteButtonProps {
  categoryId: string;
}

export function CategoryDeleteButton({
  categoryId,
}: CategoryDeleteButtonProps) {
  const handleDelete = async () => {
    await removeCategory(categoryId);
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
