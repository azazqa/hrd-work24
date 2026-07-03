"use client";

import { Button } from "@/components/ui/button";
import { ExternalLinkIcon } from "lucide-react";

function buildTrackingUrl(template: string, invoiceNumber: string): string {
  return template.replaceAll("{Invoice_number}", invoiceNumber);
}

export function TrackingLink({
  invoiceNumber,
  courierUrlTemplate,
  className,
}: {
  invoiceNumber: string;
  courierUrlTemplate?: string | null;
  className?: string;
}) {
  if (!invoiceNumber) return <span className={className}>-</span>;
  if (!courierUrlTemplate?.trim()) {
    return <span className={className}>{invoiceNumber}</span>;
  }

  const href = buildTrackingUrl(courierUrlTemplate.trim(), invoiceNumber);

  return (
    <div className="flex items-center gap-1">
      {invoiceNumber}
      <Button
        type="button"
        variant="link"
        size="icon"
        className="w-4 h-4 hover:text-primary"
        onClick={() => window.open(href, "_blank", "noopener,noreferrer")}
        title="배송 조회 열기"
        aria-label="배송 조회 열기"
      >
        <ExternalLinkIcon className="h-3 w-3" />
      </Button>
    </div>
  );
}

