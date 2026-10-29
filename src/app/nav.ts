import { CalendarCheck, FolderKanban, Map, Settings, type LucideIcon } from "lucide-react";
import type { ComponentType } from "react";
import { Today } from "../features/today";
import { Roadmap } from "../features/roadmap";
import { Projects } from "../features/projects";
import { SettingsPage } from "../features/settings";

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
  { path: "/settings", label: "Settings", icon: Settings, page: SettingsPage },
];
