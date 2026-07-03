"use client";

import { removeLogisticsLocation } from "@/components/actions/logistics-locations-action";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface LogisticsLocationDeleteButtonProps {
  locationId: string;
}

export function LogisticsLocationDeleteButton({
  locationId,
}: LogisticsLocationDeleteButtonProps) {
  const handleDelete = async () => {
    await removeLogisticsLocation(locationId);
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
