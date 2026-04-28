import { useState, useEffect, useRef } from "react";
import { Search, X, Clock, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "community.search.history";
const MAX_HISTORY = 8;

const HOT_KEYWORDS_BY_TAB: Record<string, string[]> = {
  plaza: ["科学换粮", "新手养猫", "驱虫科普", "萌宠日常", "救助记录"],
  guardian: ["小橘", "TNR", "流浪猫", "上海", "康复中"],
  radar: ["金毛", "田园猫", "走丢", "浦东", "悬赏"],
};

const TAB_PLACEHOLDERS: Record<string, string> = {
  plaza: "搜索动态、标签、用户...",
  guardian: "搜索救助故事、TNR协作...",
  radar: "搜索宠物名、品种、走失地点...",
};

const loadHistory = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
};

const saveHistory = (list: string[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_HISTORY)));
  } catch {
    /* ignore */
  }
};

interface CommunitySearchBarProps {
  activeTab: "plaza" | "guardian" | "radar";
  value: string;
  onChange: (value: string) => void;
}

const CommunitySearchBar = ({ activeTab, value, onChange }: CommunitySearchBarProps) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [history, setHistory] = useState<string[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => setDraft(value), [value]);
  useEffect(() => setHistory(loadHistory()), []);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const commit = (term: string) => {
    const t = term.trim();
    onChange(t);
    if (t) {
      const next = [t, ...history.filter((h) => h !== t)].slice(0, MAX_HISTORY);
      setHistory(next);
      saveHistory(next);
    }
    setOpen(false);
  };

  const clearHistory = () => {
    setHistory([]);
    saveHistory([]);
  };

  const removeOne = (term: string) => {
    const next = history.filter((h) => h !== term);
    setHistory(next);
    saveHistory(next);
  };

  const hot = HOT_KEYWORDS_BY_TAB[activeTab] || [];

  return (
    <div ref={wrapRef} className="relative px-4 pb-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit(draft);
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder={TAB_PLACEHOLDERS[activeTab]}
          aria-label="社区搜索"
          className="w-full h-10 pl-9 pr-20 rounded-full bg-secondary text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary"
        />
        {value && (
          <button
            type="button"
            onClick={() => commit("")}
            aria-label="清空搜索"
            className="absolute right-14 top-1/2 -translate-y-1/2 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-full hover:bg-muted"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
        <button
          type="button"
          onClick={() => commit(draft)}
          className="absolute right-1 top-1/2 -translate-y-1/2 h-8 px-3 rounded-full bg-primary text-primary-foreground text-xs font-bold"
        >
          搜索
        </button>
      </div>

      {open && (
        <div className="absolute left-4 right-4 top-full mt-2 z-50 bg-popover border border-border rounded-2xl shadow-lg p-3 max-h-[60vh] overflow-y-auto animate-fade-in-up">
          {history.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" /> 搜索历史
                </span>
                <button
                  type="button"
                  onClick={clearHistory}
                  className="text-[11px] text-muted-foreground hover:text-destructive"
                >
                  清空
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {history.map((h) => (
                  <span
                    key={h}
                    className="group inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-secondary text-xs text-foreground"
                  >
                    <button type="button" onClick={() => commit(h)} className="leading-none">
                      {h}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeOne(h)}
                      aria-label={`移除 ${h}`}
                      className="min-w-[20px] min-h-[20px] flex items-center justify-center rounded-full hover:bg-muted"
                    >
                      <X className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center gap-1 mb-2">
              <Flame className="w-3 h-3 text-destructive" />
              <span className="text-xs font-bold text-foreground">热搜词</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {hot.map((kw, idx) => (
                <button
                  key={kw}
                  type="button"
                  onClick={() => commit(kw)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-semibold transition-colors",
                    idx < 3
                      ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                      : "bg-secondary text-foreground hover:bg-muted",
                  )}
                >
                  {idx < 3 && <span className="mr-0.5">{idx + 1}</span>}
                  {kw}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunitySearchBar;
