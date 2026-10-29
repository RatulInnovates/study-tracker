import type { Db } from "./types";
import type { SessionRow } from "./today";

export interface RoadmapSession extends SessionRow {
  module_title: string;
  module_code: string;
  level_id: number;
}
export interface RoadmapLevel {
  id: number;
  num: number;
  title: string;
  phase_number: number;
  phase_name: string;
  unshipped: number;
}

export async function loadRoadmap(db: Db) {
  const levels = await db.select<RoadmapLevel>(
    `SELECT l.id, l.num, l.title, p.number phase_number, p.name phase_name,
       (SELECT COUNT(*) FROM projects pr WHERE pr.level_id = l.id AND pr.status != 'shipped') unshipped
     FROM levels l JOIN phases p ON p.id = l.phase_id ORDER BY l.num`,
  );
  const sessions = await db.select<RoadmapSession>(
    `SELECT s.id, s.module_id, s.title, s.kind, s.est_minutes, s.status, s.scheduled_date, l.num level_num,
       m.title module_title, m.code module_code, l.id level_id
     FROM sessions s JOIN modules m ON m.id = s.module_id JOIN levels l ON l.id = m.level_id ORDER BY s.seq`,
  );
  return { levels, sessions };
}
