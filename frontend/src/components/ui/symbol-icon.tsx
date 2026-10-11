import type { CSSProperties } from "react";
import {
  Plus, Link, Building2, ChevronDown, ArrowRight, ArrowUpRight, ClipboardList,
  Sparkles, Zap, Calendar, GitBranch, Check, CircleCheck, ChevronLeft,
  ChevronRight, X, PanelsTopLeft, Server, Download, GripHorizontal, LayoutGrid,
  CircleHelp, Hourglass, Network, Layers, Lightbulb, MapPin, Mail, Ellipsis,
  Banknote, User, Brain, Clock, Search, Star, RefreshCw, Terminal, SlidersHorizontal,
  ChevronsUpDown, BadgeCheck, Columns3, List, type LucideIcon,
} from "lucide-react";

const symbols: Record<string, LucideIcon> = {
  add: Plus, add_link: Link, apartment: Building2, arrow_drop_down: ChevronDown,
  arrow_forward: ArrowRight, arrow_outward: ArrowUpRight, assignment: ClipboardList,
  auto_awesome: Sparkles, bolt: Zap, calendar_today: Calendar, call_split: GitBranch,
  check: Check, check_circle: CircleCheck, chevron_left: ChevronLeft,
  chevron_right: ChevronRight, close: X, developer_board: PanelsTopLeft, dns: Server,
  download: Download, drag_handle: GripHorizontal, expand_more: ChevronDown,
  fact_check: ClipboardList, grid_view: LayoutGrid, help_outline: CircleHelp,
  hourglass_empty: Hourglass, hub: Network, layers: Layers, lightbulb: Lightbulb,
  location_on: MapPin, mail: Mail, more_horiz: Ellipsis, payments: Banknote,
  person: User, psychology: Brain, schedule: Clock, search: Search, star: Star,
  sync: RefreshCw, terminal: Terminal, tune: SlidersHorizontal,
  unfold_more: ChevronsUpDown, verified: BadgeCheck, view_kanban: Columns3, view_list: List,
};

/** Local SVGs keep icon labels from becoming visible text when a font is unavailable. */
export function SymbolIcon({ name, className = "", style }: {
  name: string; className?: string; style?: CSSProperties;
}) {
  const Icon = symbols[name] ?? CircleHelp;
  return <Icon aria-hidden="true" className={`inline-block shrink-0 align-middle ${className}`}
    style={{ width: "1em", height: "1em", fontSize: "20px", ...style }} />;
}
