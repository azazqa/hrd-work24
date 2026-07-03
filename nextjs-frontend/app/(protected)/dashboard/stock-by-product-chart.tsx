"use client";

import type { ComponentType } from "react";
import ReactECharts from "echarts-for-react";

type StockByProductPoint = {
  label: string; // 상품 표시명
  normal: number;
  refurb: number;
  disposal: number;
  undecided: number;
};

const Chart = ReactECharts as unknown as ComponentType<{ option?: unknown }>;

export function StockByProductChart({ data }: { data: StockByProductPoint[] }) {
  if (!data.length) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        데이터 없음
      </div>
    );
  }

  const labels = data.map((x) => x.label);
  const CONDITION_COLOR: Record<string, string> = {
    normal: "#3b82f6", // blue
    refurb: "#eab308", // yellow
    disposal: "#374151", // dark gray
    undecided: "#f97316", // orange
  };

  const seriesByCondition: Array<{
    key: "normal" | "refurb" | "disposal" | "undecided";
    name: string;
  }> = [
    { key: "normal", name: "정상" },
    { key: "refurb", name: "리퍼" },
    { key: "disposal", name: "폐기" },
    { key: "undecided", name: "미정" },
  ];

  const option = {
    grid: { left: 36, right: 52, top: 36, bottom: 16, containLabel: true },
    legend: { top: 0 },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      valueFormatter: (v: number) => Number(v).toLocaleString(),
    },
    xAxis: { type: "value" },
    yAxis: {
      type: "category",
      data: labels,
    },
    series: [
      ...seriesByCondition.map((s) => ({
        name: s.name,
        type: "bar",
        stack: "quantity",
        itemStyle: {
          color: CONDITION_COLOR[s.key],
        },
        data: data.map((x) => Number(x[s.key] ?? 0)),
        label: {
          show: false,
        },
      })),
      {
        name: "합계",
        type: "bar",
        stack: "quantity",
        data: data.map((x) => {
          const total =
            Number(x.normal ?? 0) +
            Number(x.refurb ?? 0) +
            Number(x.disposal ?? 0) +
            Number(x.undecided ?? 0);
          return {
            value: 0,
            label: {
              show: true,
              position: "right",
              formatter: total.toLocaleString(),
              color: "#111827",
            },
          };
        }),
        itemStyle: { color: "transparent" },
        tooltip: { show: false },
      },
    ],
  };

  return <Chart option={option} />;
}

