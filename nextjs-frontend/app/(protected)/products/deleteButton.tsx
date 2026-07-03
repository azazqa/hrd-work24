"use client";

import { removeProduct } from "@/components/actions/products-action";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface ProductDeleteButtonProps {
  productId: string;
}

export function ProductDeleteButton({ productId }: ProductDeleteButtonProps) {
  const handleDelete = async () => {
    await removeProduct(productId);
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
