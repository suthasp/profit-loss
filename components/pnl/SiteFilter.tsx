"use client";

import { useMemo, useState } from "react";
import { ChevronDown, MapPin, Search, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Multi-select for Site Name. An empty selection means "All Sites". */
export function SiteFilter({
  sites,
  selected,
  onChange,
}: {
  sites: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? sites.filter((s) => s.toLowerCase().includes(q)) : sites;
  }, [sites, query]);

  const toggle = (site: string, checked: boolean) =>
    onChange(checked ? [...selected, site] : selected.filter((s) => s !== site));

  const label =
    selected.length === 0
      ? "All Sites"
      : selected.length === 1
        ? selected[0]
        : `${selected.length} sites`;

  return (
    <div className="flex items-center gap-1">
      <Popover onOpenChange={(open) => !open && setQuery("")}>
        <PopoverTrigger
          aria-label="Site Name"
          className={cn(
            "flex h-9 min-w-40 max-w-60 items-center gap-1.5 rounded-lg border border-input bg-card py-2 pr-2 pl-2.5 text-sm whitespace-nowrap outline-none",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            selected.length > 0 && "border-foreground/30",
          )}
        >
          <MapPin className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate text-left">{label}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 gap-2 p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sites..."
              aria-label="Search sites"
              className="h-8 pl-8"
            />
          </div>

          <div className="flex items-center justify-between px-1 text-xs">
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground disabled:opacity-40"
              disabled={visible.length === 0}
              onClick={() => onChange([...new Set([...selected, ...visible])])}
            >
              Select all{query ? " shown" : ""}
            </button>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground disabled:opacity-40"
              disabled={selected.length === 0}
              onClick={() => onChange([])}
            >
              Clear
            </button>
          </div>

          <ul className="-mx-1 max-h-72 overflow-y-auto" role="listbox" aria-multiselectable>
            {visible.length === 0 ? (
              <li className="px-3 py-6 text-center text-xs text-muted-foreground">No sites match.</li>
            ) : (
              visible.map((site) => {
                const checked = selectedSet.has(site);
                return (
                  <li key={site} role="option" aria-selected={checked}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
                      <Checkbox checked={checked} onCheckedChange={(c) => toggle(site, c)} />
                      <span className="truncate">{site}</span>
                    </label>
                  </li>
                );
              })
            )}
          </ul>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <button
          type="button"
          aria-label="Clear site filter"
          onClick={() => onChange([])}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
