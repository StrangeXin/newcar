'use client';

import { ReactNode } from 'react';
import { Braces, Hash, List, SquareDashedKanban } from 'lucide-react';

interface StructuredDataViewProps {
  data?: unknown;
  emptyText: string;
}

function toLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^\w/, (c) => c.toUpperCase());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function PrimitiveValue({ value }: { value: string | number | boolean | null }) {
  return (
    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
      {value === null ? 'null' : String(value)}
    </span>
  );
}

function ArrayBlock({ items }: { items: unknown[] }) {
  const primitiveItems = items.filter((item) => ['string', 'number', 'boolean'].includes(typeof item));
  const objectItems = items.filter((item) => isRecord(item));
  const arrayItems = items.filter((item) => Array.isArray(item)) as unknown[][];

  return (
    <div className="space-y-2">
      {primitiveItems.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {primitiveItems.map((item, index) => (
            <PrimitiveValue key={`${String(item)}-${index}`} value={item as string | number | boolean} />
          ))}
        </div>
      ) : null}
      {objectItems.map((item, index) => (
        <div key={index} className="rounded-lg border border-slate-200 bg-white p-3">
          <ObjectBlock data={item} />
        </div>
      ))}
      {arrayItems.map((item, index) => (
        <div key={`nested-array-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">Items</p>
          <ArrayBlock items={item} />
        </div>
      ))}
    </div>
  );
}

function ObjectBlock({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  return (
    <div className="space-y-3">
      {entries.map(([key, value]) => {
        const label = toLabel(key);
        let content: ReactNode;

        if (Array.isArray(value)) {
          content = <ArrayBlock items={value} />;
        } else if (isRecord(value)) {
          content = (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <ObjectBlock data={value} />
            </div>
          );
        } else {
          content = <PrimitiveValue value={(value ?? null) as string | number | boolean | null} />;
        }

        return (
          <div key={key} className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">{label}</p>
            {content}
          </div>
        );
      })}
    </div>
  );
}

export function StructuredDataView({ data, emptyText }: StructuredDataViewProps) {
  if (!data) {
    return <p className="text-sm text-slate-500">{emptyText}</p>;
  }

  const isArrayData = Array.isArray(data);
  const isObjectData = isRecord(data);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        {isObjectData ? <Braces className="h-4 w-4" /> : isArrayData ? <List className="h-4 w-4" /> : <Hash className="h-4 w-4" />}
        <span className="font-semibold">结构化视图</span>
        <SquareDashedKanban className="ml-auto h-4 w-4 text-slate-400" />
      </div>
      {isObjectData ? (
        <ObjectBlock data={data} />
      ) : isArrayData ? (
        <ArrayBlock items={data} />
      ) : (
        <PrimitiveValue value={(data ?? null) as string | number | boolean | null} />
      )}
    </div>
  );
}
