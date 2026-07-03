"use client";

import { removeProductAliasDict, removeProductAliasDictGroup } from "@/components/actions/product-alias-dicts-action";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export function ProductAliasDeleteButton({ aliasItemId }: { aliasItemId: string }) {
  const handleDelete = async () => {
    await removeProductAliasDict(aliasItemId);
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
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}

export function ProductAliasGroupDeleteButton({ alias }: { alias: string }) {
  const handleDelete = async () => {
    await removeProductAliasDictGroup(alias);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="text-muted-foreground hover:text-red-600 hover:bg-accent"
      onClick={handleDelete}
      title="별칭 삭제"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
