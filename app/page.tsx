"use client";

import { ChangeEvent, CSSProperties, MouseEvent, useEffect, useMemo, useRef, useState } from "react";

type Memory = {
  id: string;
  date: string;
  label: string;
  quote: string;
  photo: string;
  sketch: string;
  anchor: { x: number; y: number };
  categoryIds: string[];
  createdAt: string;
  isDayCover?: boolean;
  isCustom?: boolean;
};

type Category = {
  id: string;
  label: string;
  custom?: boolean;
  sketch: string;
  quote: string;
};

type Draft = Pick<Memory, "date" | "label" | "quote" | "photo" | "sketch" | "anchor" | "categoryIds">;
type View = "calendar" | "reader" | "create" | "archive";
type ArchiveMode = "time" | "category";

const STORAGE_KEY = "yizhen-memory-store-v2";
const LEGACY_STORAGE_KEY = "yizhen-daily-memories-v1";

const SYSTEM_CATEGORIES: Category[] = [
  { id: "relationships", label: "人与关系", sketch: "/memories/sculptures-sketch.png", quote: "那一刻，我们刚好靠得很近。" },
  { id: "animals", label: "动物伙伴", sketch: "/memories/cat-sketch.png", quote: "它看向我的时候，时间慢了一点。" },
  { id: "places", label: "地点旅途", sketch: "/memories/sculptures-sketch.png", quote: "走到这里的时候，我想把这一刻留下。" },
  { id: "tastes", label: "食物心意", sketch: "/memories/cake-sketch.png", quote: "这一份心意，值得被记住。" },
  { id: "moments", label: "日常片刻", sketch: "/memories/flowers-sketch.png", quote: "平常的一刻，也有被记住的理由。" },
];

const DEMO_MEMORIES: Memory[] = [
  {
    id: "sculptures",
    date: "2026-08-21",
    label: "并肩",
    quote: "那天，我们刚好并肩。",
    photo: "/memories/sculptures.jpg",
    sketch: "/memories/sculptures-sketch.png",
    anchor: { x: 69, y: 47 },
    categoryIds: ["relationships"],
    createdAt: "2026-08-21T09:00:00.000Z",
    isDayCover: true,
  },
  {
    id: "flowers",
    date: "2026-08-22",
    label: "花束",
    quote: "花束里，藏着一句没说完的话。",
    photo: "/memories/flowers.jpg",
    sketch: "/memories/flowers-sketch.png",
    anchor: { x: 51, y: 59 },
    categoryIds: ["tastes"],
    createdAt: "2026-08-22T10:00:00.000Z",
    isDayCover: true,
  },
  {
    id: "cake",
    date: "2026-08-23",
    label: "小刺猬",
    quote: "那天的甜，是一只小刺猬。",
    photo: "/memories/cake.jpg",
    sketch: "/memories/cake-sketch.png",
    anchor: { x: 50, y: 47 },
    categoryIds: ["tastes"],
    createdAt: "2026-08-23T11:00:00.000Z",
    isDayCover: true,
  },
  {
    id: "cat",
    date: "2026-08-24",
    label: "草丛里的猫",
    quote: "草丛里，目光先碰到了我。",
    photo: "/memories/cat.jpg",
    sketch: "/memories/cat-sketch.png",
    anchor: { x: 70, y: 46 },
    categoryIds: ["animals"],
    createdAt: "2026-08-24T12:00:00.000Z",
    isDayCover: true,
  },
];

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

function localIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return `${year} / ${String(month).padStart(2, "0")} / ${String(day).padStart(2, "0")}`;
}

function formatDateShort(date: string) {
  const [, month, day] = date.split("-").map(Number);
  return `${month} 月 ${day} 日`;
}

function monthTitle(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return `${year} 年 ${month} 月`;
}

function daysForMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

function firstMondayOffset(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return (new Date(year, month - 1, 1).getDay() + 6) % 7;
}

function dayIso(monthKey: string, day: number) {
  return `${monthKey}-${String(day).padStart(2, "0")}`;
}

function offsetIsoDate(date: string, offset: number) {
  const [year, month, day] = date.split("-").map(Number);
  return localIsoDate(new Date(year, month - 1, day + offset, 12));
}

function weekdayLabel(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return ["日", "一", "二", "三", "四", "五", "六"][new Date(year, month - 1, day, 12).getDay()];
}

function emptyDraft(date: string): Draft {
  return {
    date,
    label: "今天的记忆",
    quote: "",
    photo: "",
    sketch: "/memories/cat-sketch.png",
    anchor: { x: 50, y: 50 },
    categoryIds: ["moments"],
  };
}

function fallbackCategories(memory: Partial<Memory>) {
  if (memory.sketch?.includes("sculptures")) return ["relationships"];
  if (memory.sketch?.includes("flowers")) return ["tastes"];
  if (memory.sketch?.includes("cake")) return ["tastes"];
  if (memory.sketch?.includes("cat")) return ["animals"];
  return ["moments"];
}

function primaryCategoryId(categoryIds: string[] | undefined, memory: Partial<Memory>) {
  for (const id of categoryIds || []) {
    if (id.startsWith("custom-")) return id;
    if (["relationships", "animals", "places", "tastes", "moments"].includes(id)) return id;
    if (["food", "gifts", "occasions"].includes(id)) return "tastes";
    if (["nature", "uncategorized"].includes(id)) return "moments";
  }
  return fallbackCategories(memory)[0];
}

function normalizeMemory(value: Partial<Memory> & { day?: number }, index: number): Memory | null {
  if (!value.id || !value.photo || !value.sketch) return null;
  const rawDate = value.date || `2026-08-${String(value.day ?? 24).padStart(2, "0")}`;
  const date = rawDate.replaceAll(".", "-");
  return {
    id: value.id,
    date,
    label: value.label || "一段记忆",
    quote: value.quote || "今天，有一个瞬间留了下来。",
    photo: value.photo,
    sketch: value.sketch,
    anchor: value.anchor || { x: 50, y: 50 },
    categoryIds: [primaryCategoryId(value.categoryIds, value)],
    createdAt: value.createdAt || `${date}T${String(9 + index).padStart(2, "0")}:00:00.000Z`,
    isDayCover: value.isDayCover,
    isCustom: value.isCustom,
  };
}

function ensureDayCovers(items: Memory[]) {
  const grouped = new Map<string, Memory[]>();
  items.forEach((memory) => grouped.set(memory.date, [...(grouped.get(memory.date) || []), memory]));
  const coverIds = new Set<string>();
  grouped.forEach((group) => coverIds.add(group.find((item) => item.isDayCover)?.id || group[0].id));
  return items.map((memory) => ({ ...memory, isDayCover: coverIds.has(memory.id) }));
}

function CoverContent({ memory }: { memory: Pick<Memory, "label" | "quote" | "sketch" | "date"> }) {
  return (
    <div className="cover-content">
      <div className="cover-illustration">
        <img src={memory.sketch} alt={`${memory.label}的记忆锚点简笔画`} />
      </div>
      <p className="cover-quote">{memory.quote}</p>
      <p className="cover-date">{formatDate(memory.date)}</p>
    </div>
  );
}

function MemoryPaper({ memory, variant = "reader" }: { memory: Memory; variant?: "reader" | "home" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [tearShift, setTearShift] = useState(46);

  const measurePhoto = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    const ratio = image.naturalWidth / image.naturalHeight;
    const halfVisibleHeight = ratio > 0.8 ? 35.2 / ratio : 44;
    setTearShift(Math.min(46, Math.max(18, halfVisibleHeight + 2)));
  };

  return (
    <section
      className={`memory-paper ${variant === "home" ? "is-home" : ""} ${isOpen ? "is-open" : ""}`}
      style={{ "--tear-shift": `${tearShift}%`, "--tear-shift-negative": `-${tearShift}%` } as CSSProperties}
    >
      <div className="photo-underlay" aria-hidden={!isOpen}>
        <img className="photo-backdrop" src={memory.photo} alt="" />
        <img className="photo-original" src={memory.photo} alt={`${memory.label}的原始照片`} onLoad={measurePhoto} />
      </div>
      <div className="cover-whole"><CoverContent memory={memory} /></div>
      <div className="tear-piece tear-piece-top" aria-hidden="true"><CoverContent memory={memory} /></div>
      <div className="tear-piece tear-piece-bottom" aria-hidden="true"><CoverContent memory={memory} /></div>
      <button
        type="button"
        className="anchor-toggle"
        aria-label={isOpen ? "合拢这段记忆" : "撕开并查看原始照片"}
        aria-pressed={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      />
    </section>
  );
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("照片读取失败"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("照片格式暂不支持"));
      image.onload = () => {
        const maxEdge = 1600;
        const ratio = Math.min(1, maxEdge / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * ratio);
        canvas.height = Math.round(image.height * ratio);
        const context = canvas.getContext("2d");
        if (!context) return reject(new Error("无法处理照片"));
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const today = localIsoDate();
  const [memories, setMemories] = useState<Memory[]>(DEMO_MEMORIES);
  const [customCategories, setCustomCategories] = useState<Category[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<View>("archive");
  const [calendarMonth, setCalendarMonth] = useState(today.slice(0, 7));
  const [selectedId, setSelectedId] = useState(DEMO_MEMORIES.at(-1)?.id ?? "cat");
  const [createStep, setCreateStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(emptyDraft(today));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [formNotice, setFormNotice] = useState("");
  const [turnDirection, setTurnDirection] = useState<"next" | "previous" | null>(null);
  const [archiveMode, setArchiveMode] = useState<ArchiveMode>("time");
  const [archiveCategoryId, setArchiveCategoryId] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const homeSwipeStartX = useRef<number | null>(null);
  const yearRailRef = useRef<HTMLDivElement>(null);
  const monthRailRef = useRef<HTMLDivElement>(null);
  const yearSnapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const monthSnapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickerSyncingRef = useRef(false);
  const pickerSyncReleaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as { memories?: Array<Partial<Memory>>; customCategories?: Category[] };
        const saved = (parsed.memories || []).map(normalizeMemory).filter((item): item is Memory => Boolean(item));
        if (saved.length) setMemories(ensureDayCovers(saved));
        if (Array.isArray(parsed.customCategories)) setCustomCategories(parsed.customCategories);
      } else {
        const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy) {
          const parsed = JSON.parse(legacy) as Array<Partial<Memory> & { day?: number }>;
          const migrated = parsed.map(normalizeMemory).filter((item): item is Memory => Boolean(item));
          if (migrated.length) setMemories(ensureDayCovers(migrated));
        }
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ memories, customCategories }));
    } catch {
      setFormNotice("当前浏览器存储空间不足，但本次内容仍可继续查看。");
    }
  }, [memories, customCategories, hydrated]);

  const allCategories = useMemo(() => [...SYSTEM_CATEGORIES, ...customCategories], [customCategories]);
  const sortedMemories = useMemo(
    () => [...memories].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [memories],
  );
  const memoriesByDate = useMemo(() => {
    const grouped = new Map<string, Memory[]>();
    [...memories]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .forEach((memory) => grouped.set(memory.date, [...(grouped.get(memory.date) || []), memory]));
    return grouped;
  }, [memories]);
  const selectedMemory = memories.find((memory) => memory.id === selectedId) || sortedMemories[0] || DEMO_MEMORIES[0];
  const selectedDayMemories = memoriesByDate.get(selectedMemory.date) || [selectedMemory];
  const recordedDates = useMemo(() => [...memoriesByDate.keys()].sort(), [memoriesByDate]);
  const selectedRecordedDateIndex = recordedDates.indexOf(selectedMemory.date);
  const homeDateStrip = Array.from({ length: 7 }, (_, index) => offsetIsoDate(selectedMemory.date, index - 3));
  const calendarDates = Array.from({ length: daysForMonth(calendarMonth) }, (_, index) => dayIso(calendarMonth, index + 1));
  const leadingCalendarBlanks = firstMondayOffset(calendarMonth);
  const trailingCalendarBlanks = 42 - leadingCalendarBlanks - calendarDates.length;
  const [selectedCalendarYear, selectedCalendarMonth] = calendarMonth.split("-").map(Number);
  const currentYear = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7));
  const earliestMemoryYear = memories.reduce((earliest, memory) => Math.min(earliest, Number(memory.date.slice(0, 4))), currentYear);
  const firstSelectableYear = Math.min(currentYear - 120, earliestMemoryYear);
  const calendarYears = Array.from({ length: currentYear - firstSelectableYear + 1 }, (_, index) => firstSelectableYear + index);
  const availableMonths = Array.from({ length: selectedCalendarYear === currentYear ? currentMonth : 12 }, (_, index) => index + 1);
  const openedCategoryMemories = useMemo(() => (
    archiveCategoryId
      ? sortedMemories.filter((memory) => memory.categoryIds[0] === archiveCategoryId)
      : []
  ), [archiveCategoryId, sortedMemories]);
  const openedCategoryTitle = allCategories.find((category) => category.id === archiveCategoryId)?.label || "";

  const dayCover = (items: Memory[]) => items.find((memory) => memory.isDayCover) || items[0];

  const openArchiveCategory = (categoryId: string) => {
    setArchiveCategoryId(categoryId);
  };

  const closeArchiveBook = () => {
    setArchiveCategoryId(null);
  };

  const selectCalendarYear = (year: number) => {
    const lastMonth = year === currentYear ? currentMonth : 12;
    const month = Math.min(selectedCalendarMonth, lastMonth);
    setCalendarMonth(`${year}-${String(month).padStart(2, "0")}`);
  };

  const selectCalendarMonth = (month: number) => {
    const lastMonth = selectedCalendarYear === currentYear ? currentMonth : 12;
    if (month > lastMonth) return;
    setCalendarMonth(`${selectedCalendarYear}-${String(month).padStart(2, "0")}`);
  };

  const nearestPickerValue = (container: HTMLDivElement, selector: string, axis: "x" | "y") => {
    const items = [...container.querySelectorAll<HTMLButtonElement>(selector)];
    const center = axis === "x" ? container.scrollLeft + container.clientWidth / 2 : container.scrollTop + container.clientHeight / 2;
    return items.reduce<HTMLButtonElement | null>((nearest, item) => {
      if (!nearest) return item;
      const itemCenter = axis === "x" ? item.offsetLeft + item.offsetWidth / 2 : item.offsetTop + item.offsetHeight / 2;
      const nearestCenter = axis === "x" ? nearest.offsetLeft + nearest.offsetWidth / 2 : nearest.offsetTop + nearest.offsetHeight / 2;
      return Math.abs(itemCenter - center) < Math.abs(nearestCenter - center) ? item : nearest;
    }, null);
  };

  const scheduleYearSelection = () => {
    if (pickerSyncingRef.current) return;
    if (yearSnapTimer.current) clearTimeout(yearSnapTimer.current);
    yearSnapTimer.current = setTimeout(() => {
      const container = yearRailRef.current;
      if (!container) return;
      const nearest = nearestPickerValue(container, "[data-year]", "x");
      if (nearest?.dataset.year) selectCalendarYear(Number(nearest.dataset.year));
    }, 140);
  };

  const scheduleMonthSelection = () => {
    if (pickerSyncingRef.current) return;
    if (monthSnapTimer.current) clearTimeout(monthSnapTimer.current);
    monthSnapTimer.current = setTimeout(() => {
      const container = monthRailRef.current;
      if (!container) return;
      const nearest = nearestPickerValue(container, "[data-month]", "y");
      if (nearest?.dataset.month) selectCalendarMonth(Number(nearest.dataset.month));
    }, 140);
  };

  useEffect(() => {
    if (view !== "calendar") return;
    pickerSyncingRef.current = true;
    if (pickerSyncReleaseTimer.current) clearTimeout(pickerSyncReleaseTimer.current);
    const frame = requestAnimationFrame(() => {
      const yearButton = yearRailRef.current?.querySelector<HTMLButtonElement>(`[data-year="${selectedCalendarYear}"]`);
      const monthButton = monthRailRef.current?.querySelector<HTMLButtonElement>(`[data-month="${selectedCalendarMonth}"]`);
      if (yearRailRef.current && yearButton) {
        yearRailRef.current.scrollTo({ left: yearButton.offsetLeft - (yearRailRef.current.clientWidth - yearButton.offsetWidth) / 2, behavior: "auto" });
      }
      if (monthRailRef.current && monthButton) {
        monthRailRef.current.scrollTo({ top: monthButton.offsetTop - (monthRailRef.current.clientHeight - monthButton.offsetHeight) / 2, behavior: "auto" });
      }
      pickerSyncReleaseTimer.current = setTimeout(() => {
        pickerSyncingRef.current = false;
      }, 80);
    });
    return () => cancelAnimationFrame(frame);
  }, [view, selectedCalendarYear, selectedCalendarMonth]);

  useEffect(() => () => {
    if (yearSnapTimer.current) clearTimeout(yearSnapTimer.current);
    if (monthSnapTimer.current) clearTimeout(monthSnapTimer.current);
    if (pickerSyncReleaseTimer.current) clearTimeout(pickerSyncReleaseTimer.current);
  }, []);

  const openMemory = (memory: Memory) => {
    setSelectedId(memory.id);
    setView("reader");
  };

  const openDate = (date: string) => {
    const items = memoriesByDate.get(date) || [];
    if (!items.length) {
      startCreate(date);
      return;
    }
    openMemory(dayCover(items));
  };

  const startCreate = (date = today) => {
    setDraft(emptyDraft(date > today ? today : date));
    setEditingId(null);
    setCreateStep(0);
    setFormNotice("");
    setView("create");
  };

  const startEdit = (memory: Memory) => {
    setDraft({
      date: memory.date,
      label: memory.label,
      quote: memory.quote,
      photo: memory.photo,
      sketch: memory.sketch,
      anchor: memory.anchor,
      categoryIds: memory.categoryIds,
    });
    setEditingId(memory.id);
    setCreateStep(2);
    setFormNotice("");
    setView("create");
  };

  const changeDay = (direction: -1 | 1) => {
    const nextIndex = selectedRecordedDateIndex + direction;
    if (nextIndex < 0 || nextIndex >= recordedDates.length) return;
    const nextDate = recordedDates[nextIndex];
    const nextMemories = memoriesByDate.get(nextDate) || [];
    if (!nextMemories.length) return;
    setTurnDirection(direction === 1 ? "next" : "previous");
    setSelectedId(dayCover(nextMemories).id);
    window.setTimeout(() => setTurnDirection(null), 560);
  };

  const handleHomeTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    homeSwipeStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleHomeTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    if (homeSwipeStartX.current === null) return;
    const distance = (event.changedTouches[0]?.clientX ?? homeSwipeStartX.current) - homeSwipeStartX.current;
    homeSwipeStartX.current = null;
    if (Math.abs(distance) < 46) return;
    changeDay(distance < 0 ? 1 : -1);
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFormNotice("请选择 JPG、PNG 或 HEIC 照片。");
      return;
    }
    try {
      const photo = await compressImage(file);
      setDraft((current) => ({
        ...current,
        photo,
        label: current.label === "今天的记忆" ? file.name.replace(/\.[^.]+$/, "") || "今天的记忆" : current.label,
      }));
      setFormNotice("");
    } catch (error) {
      setFormNotice(error instanceof Error ? error.message : "照片读取失败");
    }
  };

  const moveAnchor = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(94, Math.max(6, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(92, Math.max(8, ((event.clientY - rect.top) / rect.height) * 100));
    setDraft((current) => ({ ...current, anchor: { x, y } }));
  };

  const selectCategory = (categoryId: string) => {
    setFormNotice("");
    setDraft((current) => ({ ...current, categoryIds: [categoryId] }));
  };

  const createCategory = () => {
    const label = newCategory.trim();
    if (!label) return;
    const existing = allCategories.find((category) => category.label === label);
    if (existing) {
      selectCategory(existing.id);
      setNewCategory("");
      return;
    }
    const category: Category = {
      id: `custom-${Date.now()}`,
      label: label.slice(0, 10),
      custom: true,
      sketch: draft.sketch,
      quote: "这段记忆，有自己的名字。",
    };
    setCustomCategories((current) => [...current, category]);
    setDraft((current) => ({ ...current, categoryIds: [category.id] }));
    setNewCategory("");
  };

  const generateAnchor = () => {
    const category = allCategories.find((item) => draft.categoryIds.includes(item.id)) || SYSTEM_CATEGORIES[4];
    setIsGenerating(true);
    window.setTimeout(() => {
      setDraft((current) => ({
        ...current,
        sketch: category.sketch,
        quote: current.quote.trim() || category.quote,
        categoryIds: current.categoryIds.length ? [current.categoryIds[0]] : ["moments"],
      }));
      setIsGenerating(false);
      setCreateStep(3);
    }, 900);
  };

  const saveMemory = () => {
    const previous = editingId ? memories.find((memory) => memory.id === editingId) : undefined;
    const id = editingId || `local-${Date.now()}`;
    const memory: Memory = {
      id,
      date: draft.date > today ? today : draft.date,
      label: draft.label.trim() || "今天的记忆",
      quote: draft.quote.trim() || "今天，有一个瞬间留了下来。",
      photo: draft.photo,
      sketch: draft.sketch,
      anchor: draft.anchor,
      categoryIds: draft.categoryIds.length ? [draft.categoryIds[0]] : ["moments"],
      createdAt: previous?.createdAt || new Date().toISOString(),
      isDayCover: previous?.isDayCover || !(memoriesByDate.get(draft.date)?.length),
      isCustom: true,
    };
    const next = ensureDayCovers([...memories.filter((item) => item.id !== id), memory]);
    setMemories(next);
    setSelectedId(id);
    setEditingId(null);
    setView("reader");
  };

  const setAsDayCover = () => {
    setMemories((current) => current.map((memory) => (
      memory.date === selectedMemory.date ? { ...memory, isDayCover: memory.id === selectedMemory.id } : memory
    )));
  };

  const deleteCustomCategory = (categoryId: string) => {
    if (!window.confirm("删除这个自定义类别？其中的记忆不会被删除。")) return;
    setCustomCategories((current) => current.filter((category) => category.id !== categoryId));
    setMemories((current) => current.map((memory) => {
      const categoryIds = memory.categoryIds.filter((id) => id !== categoryId);
      return { ...memory, categoryIds: categoryIds.length ? [categoryIds[0]] : ["moments"] };
    }));
    setArchiveCategoryId(null);
  };

  const renameCustomCategory = (category: Category) => {
    const nextLabel = window.prompt("新的类别名称", category.label)?.trim();
    if (!nextLabel || nextLabel === category.label) return;
    setCustomCategories((current) => current.map((item) => (
      item.id === category.id ? { ...item, label: nextLabel.slice(0, 10) } : item
    )));
  };

  const draftMemory: Memory = {
    id: "draft",
    date: draft.date,
    label: draft.label || "今天的记忆",
    quote: draft.quote || "今天，有一个瞬间留了下来。",
    photo: draft.photo,
    sketch: draft.sketch,
    anchor: draft.anchor,
    categoryIds: draft.categoryIds,
    createdAt: new Date().toISOString(),
  };

  return (
    <main className="site-shell">
      <aside className="brand-rail">
        <div>
          <p className="eyebrow">DAILY MEMORY ANCHORS</p>
          <h1>一帧之后</h1>
        </div>
        <span className="rail-mark" aria-hidden="true" />
      </aside>

      <section className="app-surface" aria-label="一帧之后记忆应用">
        <header className={`app-header ${view === "calendar" ? "" : "is-secondary"}`}>
          <button type="button" className="brand-button" onClick={() => { closeArchiveBook(); setArchiveMode("time"); setView("archive"); }} aria-label="返回记忆锚点">一帧之后</button>
        </header>

        {view === "calendar" ? (
          <div className="calendar-view">
            <section className="month-intro">
              <div>
                <p className="eyebrow">MY DAILY MEMORY</p>
                <h2>{monthTitle(calendarMonth)}</h2>
              </div>
              <section className="time-ribbon" aria-label="选择日历年月">
                <div className="year-axis">
                  <div className="axis-heading"><span>年份</span><em>左右滑动</em></div>
                  <div className="year-rail" ref={yearRailRef} onScroll={scheduleYearSelection}>
                    {calendarYears.map((year) => (
                      <button
                        type="button"
                        key={year}
                        data-year={year}
                        className={year === selectedCalendarYear ? "is-selected" : ""}
                        aria-pressed={year === selectedCalendarYear}
                        onClick={() => selectCalendarYear(year)}
                      >
                        {year}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="month-axis">
                  <div className="axis-heading"><span>月份</span><em>上下滑动</em></div>
                  <div className="month-rail" ref={monthRailRef} onScroll={scheduleMonthSelection}>
                    {availableMonths.map((month) => (
                      <button
                        type="button"
                        key={month}
                        data-month={month}
                        className={month === selectedCalendarMonth ? "is-selected" : ""}
                        aria-pressed={month === selectedCalendarMonth}
                        onClick={() => selectCalendarMonth(month)}
                      >
                        {String(month).padStart(2, "0")}
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            </section>

            <section className="calendar" aria-label={`${monthTitle(calendarMonth)}记忆日历`}>
              <div className="weekday-row" aria-hidden="true">{WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}</div>
              <div className="day-grid">
                {Array.from({ length: leadingCalendarBlanks }, (_, index) => <span key={`leading-blank-${index}`} className="day-blank" />)}
                {calendarDates.map((date) => {
                  const items = memoriesByDate.get(date) || [];
                  const cover = items.length ? dayCover(items) : null;
                  const future = date > today;
                  const day = Number(date.slice(-2));
                  return (
                    <button
                      type="button"
                      key={date}
                      className={`day-cell ${cover ? "has-memory" : ""} ${date === today ? "is-today" : ""}`}
                      onClick={() => openDate(date)}
                      disabled={future}
                      aria-label={cover ? `${formatDateShort(date)}，${items.length} 条记忆` : `${formatDateShort(date)}，添加记忆`}
                    >
                      <span>{day}</span>
                      {cover ? <img src={cover.sketch} alt="" /> : null}
                      {items.length > 1 ? <b>＋{items.length - 1}</b> : null}
                    </button>
                  );
                })}
                {Array.from({ length: trailingCalendarBlanks }, (_, index) => <span key={`trailing-blank-${index}`} className="day-blank" />)}
              </div>
            </section>

          </div>
        ) : null}

        {view === "reader" ? (
          <div className="reader-view">
            <div className="reader-topline">
              <button type="button" onClick={() => { setCalendarMonth(selectedMemory.date.slice(0, 7)); setView("calendar"); }}>← 日历</button>
              <span>{formatDate(selectedMemory.date)}</span>
              <button type="button" onClick={() => startEdit(selectedMemory)}>编辑</button>
            </div>
            <div key={selectedMemory.id} className={`reader-memory-shell ${turnDirection ? `turn-${turnDirection}` : ""}`}>
              <div className="reader-heading">
                <div>
                  <p className="eyebrow">MEMORY COVER</p>
                  <h2>{selectedMemory.label}</h2>
                </div>
                {selectedDayMemories.length > 1 ? (
                  <div className="day-book-meta">
                    <span>这一天 · {selectedDayMemories.length} 页</span>
                    {!selectedMemory.isDayCover ? <button type="button" onClick={setAsDayCover}>设为当天封面</button> : <em>当天封面</em>}
                  </div>
                ) : null}
              </div>
              <MemoryPaper memory={selectedMemory} />
            </div>
            {selectedDayMemories.length > 1 ? (
              <div className="day-page-picker" aria-label="选择这一天的记忆">
                {selectedDayMemories.map((memory, index) => (
                  <button type="button" key={memory.id} aria-pressed={memory.id === selectedMemory.id} onClick={() => setSelectedId(memory.id)}>{index + 1}</button>
                ))}
              </div>
            ) : null}
            <div className="reader-nav">
              <button type="button" disabled={selectedRecordedDateIndex <= 0} onClick={() => changeDay(-1)}>← 上一天</button>
              <span>{formatDateShort(selectedMemory.date)}</span>
              <button type="button" disabled={selectedRecordedDateIndex >= recordedDates.length - 1} onClick={() => changeDay(1)}>下一天 →</button>
            </div>
            <button type="button" className="add-day-page" onClick={() => startCreate(selectedMemory.date)}>＋ 为这一天添加一页</button>
          </div>
        ) : null}

        {view === "create" ? (
          <div className="create-view">
            <div className="create-topline">
              <button type="button" onClick={() => setView(editingId ? "reader" : "calendar")}>× 取消</button>
              <span>{formatDateShort(draft.date)}</span>
              <strong>{createStep + 1} / 4</strong>
            </div>
            <div className="create-progress" aria-label={`创建进度，第 ${createStep + 1} 步，共 4 步`}>
              {[0, 1, 2, 3].map((step) => <span key={step} className={step <= createStep ? "is-active" : ""} />)}
            </div>

            {createStep === 0 ? (
              <section className="create-step">
                <p className="eyebrow">STEP 01 · DATE & PHOTO</p>
                <label className="date-field">
                  <span>记忆日期</span>
                  <input type="date" max={today} value={draft.date} onChange={(event) => event.target.value && setDraft((current) => ({ ...current, date: event.target.value }))} />
                </label>
                <input ref={fileInputRef} className="file-input" type="file" accept="image/*" onChange={handleUpload} />
                <button type="button" className="upload-button upload-button-primary" onClick={() => fileInputRef.current?.click()}>
                  <span className="upload-symbol" aria-hidden="true">＋</span>
                  <strong>{draft.photo ? "重新选择照片" : "从设备选择照片"}</strong>
                  <small>JPG、PNG 或 HEIC · 自动压缩但不裁剪</small>
                </button>
                {formNotice ? <p className="form-error" role="alert">{formNotice}</p> : null}
                {draft.photo ? <div className="uploaded-preview"><img src={draft.photo} alt="已上传的照片" /><span>已选择 · {formatDateShort(draft.date)}</span></div> : null}
                <button type="button" className="primary-action" disabled={!draft.photo || !draft.date} onClick={() => setCreateStep(1)}>下一步：选择锚点</button>
              </section>
            ) : null}

            {createStep === 1 ? (
              <section className="create-step">
                <p className="eyebrow">STEP 02 · ANCHOR</p>
                <h2>点出真正想记住的地方</h2>
                <p className="step-copy">点击照片移动锚点。简笔画只保留你选择的这一点。</p>
                <button type="button" className="anchor-canvas" onClick={moveAnchor} aria-label="点击照片选择记忆锚点">
                  <img src={draft.photo} alt="待选择锚点的照片" />
                  <span className="anchor-marker" style={{ left: `${draft.anchor.x}%`, top: `${draft.anchor.y}%` }}><i /></span>
                </button>
                <div className="step-actions">
                  <button type="button" className="secondary-action" onClick={() => setCreateStep(0)}>上一步</button>
                  <button type="button" className="primary-action" onClick={() => setCreateStep(2)}>确认这个锚点</button>
                </div>
              </section>
            ) : null}

            {createStep === 2 ? (
              <section className="create-step">
                <p className="eyebrow">STEP 03 · WORDS & CATEGORY</p>
                <h2>{editingId ? "编辑这一页" : "为这一页留下文字"}</h2>
                <label className="form-field">
                  <span>这一页叫什么？</span>
                  <input value={draft.label} maxLength={18} onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))} />
                </label>
                <label className="form-field">
                  <span>一句话记忆</span>
                  <textarea value={draft.quote} maxLength={40} rows={3} onChange={(event) => setDraft((current) => ({ ...current, quote: event.target.value }))} placeholder="例如：它看向我的时候，时间慢了一点。" />
                  <small>{draft.quote.length} / 40</small>
                </label>
                <fieldset className="category-field">
                  <legend>选择一个分类</legend>
                  <div>
                    {allCategories.map((category) => (
                      <button type="button" key={category.id} aria-pressed={draft.categoryIds[0] === category.id} onClick={() => selectCategory(category.id)}>{category.label}</button>
                    ))}
                  </div>
                </fieldset>
                <div className="inline-category-create">
                  <input value={newCategory} maxLength={10} onChange={(event) => setNewCategory(event.target.value)} placeholder="新建自己的类别" />
                  <button type="button" onClick={createCategory}>新建</button>
                </div>
                {formNotice ? <p className="form-error" role="alert">{formNotice}</p> : null}
                <div className="step-actions">
                  <button type="button" className="secondary-action" onClick={() => setCreateStep(1)}>调整锚点</button>
                  <button
                    type="button"
                    className="primary-action"
                    disabled={isGenerating}
                    onClick={editingId ? () => setCreateStep(3) : generateAnchor}
                  >
                    {editingId ? "预览修改" : isGenerating ? "正在提炼锚点…" : "生成简笔画记忆"}
                  </button>
                </div>
              </section>
            ) : null}

            {createStep === 3 ? (
              <section className="create-step confirmation-step">
                <p className="eyebrow">STEP 04 · MEMORY COVER</p>
                <h2>{editingId ? "确认修改" : "这是这一天的一页"}</h2>
                <div className="confirmation-paper"><CoverContent memory={draftMemory} /></div>
                <div className="confirmation-meta">
                  <span>{formatDate(draft.date)}</span>
                  <span>{draft.categoryIds.map((id) => allCategories.find((category) => category.id === id)?.label).filter(Boolean).join(" · ") || "未分类"}</span>
                </div>
                <div className="confirmation-photo">
                  <img src={draft.photo} alt="锚点对应的原始照片" />
                  <div><strong>原图完整保留</strong><span>不裁剪 · 不拉伸</span></div>
                </div>
                {formNotice ? <p className="form-error" role="alert">{formNotice}</p> : null}
                <div className="step-actions">
                  <button type="button" className="secondary-action" onClick={() => setCreateStep(2)}>调整文字</button>
                  <button type="button" className="primary-action" onClick={saveMemory}>{editingId ? "保存修改" : "写入这一天"}</button>
                </div>
              </section>
            ) : null}
          </div>
        ) : null}

        {view === "archive" ? (
          <div className="archive-view">
            <section className="anchor-home-heading">
              <h2>记忆锚点</h2>
              <div className="archive-tabs anchor-home-tabs" role="tablist" aria-label="记忆锚点浏览方式">
                <button type="button" role="tab" aria-selected={archiveMode === "time"} onClick={() => { closeArchiveBook(); setArchiveMode("time"); }}>时间</button>
                <button type="button" role="tab" aria-selected={archiveMode === "category"} onClick={() => { closeArchiveBook(); setArchiveMode("category"); }}>分类</button>
              </div>
            </section>

            {archiveMode === "time" ? (
              <section className="daily-anchor-browser" aria-label="按日期浏览记忆锚点" onTouchStart={handleHomeTouchStart} onTouchEnd={handleHomeTouchEnd}>
                <div className="daily-date-strip" aria-label="日期时间条">
                  {homeDateStrip.map((date) => {
                    const items = memoriesByDate.get(date) || [];
                    const isSelected = date === selectedMemory.date;
                    return (
                      <button
                        type="button"
                        key={date}
                        className={isSelected ? "is-selected" : ""}
                        disabled={!items.length}
                        aria-pressed={isSelected}
                        aria-label={`${formatDateShort(date)}${items.length ? "，有记忆锚点" : "，没有记忆锚点"}`}
                        onClick={() => items.length && setSelectedId(dayCover(items).id)}
                      >
                        <span>{weekdayLabel(date)}</span>
                        <strong>{Number(date.slice(-2))}</strong>
                      </button>
                    );
                  })}
                </div>

                <div key={selectedMemory.id} className={`daily-anchor-shell ${turnDirection ? `turn-${turnDirection}` : ""}`}>
                  <MemoryPaper memory={selectedMemory} variant="home" />
                </div>

                <div className="daily-day-nav">
                  <button type="button" disabled={selectedRecordedDateIndex <= 0} onClick={() => changeDay(-1)}>← 上一天</button>
                  <span>{formatDate(selectedMemory.date)}</span>
                  <button type="button" disabled={selectedRecordedDateIndex >= recordedDates.length - 1} onClick={() => changeDay(1)}>下一天 →</button>
                </div>

                <div className="daily-anchor-actions">
                  <button type="button" onClick={() => startEdit(selectedMemory)}><span aria-hidden="true">✎</span><strong>编辑记忆文字</strong></button>
                  <a href={selectedMemory.sketch} download={`${selectedMemory.label}-记忆锚点.png`}><span aria-hidden="true">▧</span><strong>保存简笔画</strong></a>
                </div>
              </section>
            ) : null}

            {archiveMode === "category" && !archiveCategoryId ? (
              <div className="category-archive">
                <div className="category-grid">
                  {allCategories.map((category, index) => {
                    const items = sortedMemories.filter((memory) => memory.categoryIds[0] === category.id);
                    return (
                      <article key={category.id} className="category-tile">
                        <button type="button" onClick={() => openArchiveCategory(category.id)} aria-label={`打开${category.label}分类`}>
                          <span className="category-number">{String(index + 1).padStart(2, "0")}</span>
                          <img src={(items[0] || category).sketch} alt="" />
                          <span className="category-caption"><strong>{category.label}</strong><em>{items.length} 个锚点</em></span>
                        </button>
                        {category.custom ? (
                          <div className="category-tile-actions">
                            <button type="button" onClick={() => renameCustomCategory(category)}>改名</button>
                            <button type="button" aria-label={`删除${category.label}`} onClick={() => deleteCustomCategory(category.id)}>×</button>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
                <div className="category-manager">
                  <div><strong>新建分类</strong><span>每个锚点只属于一个分类。</span></div>
                  <div className="inline-category-create">
                    <input value={newCategory} maxLength={10} onChange={(event) => setNewCategory(event.target.value)} placeholder="例如：大学生活" />
                    <button type="button" onClick={createCategory}>新建</button>
                  </div>
                </div>
              </div>
            ) : null}

            {archiveMode === "category" && archiveCategoryId ? (
              <section className="category-detail">
                <div className="category-detail-heading">
                  <button type="button" className="archive-back" onClick={closeArchiveBook}>← 所有分类</button>
                  <div><h3>{openedCategoryTitle}</h3><span>{openedCategoryMemories.length} 个锚点</span></div>
                </div>
                {openedCategoryMemories.length ? (
                  <div className="anchor-grid">
                    {openedCategoryMemories.map((memory) => (
                      <article key={memory.id} className="anchor-card">
                        <button type="button" onClick={() => openMemory(memory)} aria-label={`打开${memory.label}`}>
                          <span className="anchor-card-date">{formatDateShort(memory.date)}</span>
                          <img src={memory.sketch} alt="" />
                          <span className="anchor-card-caption"><strong>{memory.label}</strong><em>{memory.quote}</em></span>
                        </button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="empty-category"><span>这一类还没有锚点</span><button type="button" onClick={() => startCreate(today)}>＋ 记录一个</button></div>
                )}
              </section>
            ) : null}
          </div>
        ) : null}

        <nav className="app-nav" aria-label="主要导航">
          <button type="button" className={view === "archive" ? "is-active" : ""} onClick={() => { closeArchiveBook(); setArchiveMode("time"); setView("archive"); }}><span>锚</span>记忆锚点</button>
          <button type="button" className={view === "create" ? "is-active" : ""} onClick={() => startCreate(today)}><span>＋</span>记录</button>
          <button type="button" className={view === "calendar" ? "is-active" : ""} onClick={() => { setCalendarMonth(today.slice(0, 7)); setView("calendar"); }}><span>日</span>日历</button>
        </nav>

      </section>
    </main>
  );
}
