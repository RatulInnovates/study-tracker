import type { ComponentType } from "react";
import { BarChart3, ClipboardCheck, Layers, CalendarCheck, FolderKanban, Map, Settings, type LucideIcon } from "lucide-react";
import { Today } from "../features/today";
import { Roadmap } from "../features/roadmap";
import { Projects } from "../features/projects";
import { SettingsPage } from "../features/settings";
import { Review } from "../features/review";
import { Quiz } from "../features/quiz";
import { Analytics } from "../features/analytics";

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  page: ComponentType;
}

// Feature branches add their own line here (one line each, so merges stay trivial).
export const NAV: NavItem[] = [
  { path: "/", label: "Today", icon: CalendarCheck, page: Today },
  { path: "/roadmap", label: "Roadmap", icon: Map, page: Roadmap },
  { path: "/projects", label: "Projects", icon: FolderKanban, page: Projects },
  { path: "/review", label: "Review", icon: ClipboardCheck, page: Review },
  { path: "/quiz", label: "Quiz & Cards", icon: Layers, page: Quiz },
  { path: "/analytics", label: "Analytics", icon: BarChart3, page: Analytics },
  { path: "/settings", label: "Settings", icon: Settings, page: SettingsPage },
];
