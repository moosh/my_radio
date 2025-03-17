export interface ScheduleItem {
  day: number;  // 0-6 for Sunday-Saturday
  startHour: number;  // 0-23
  endHour: number;  // 0-23
}

export interface Station {
  id: string;
  title: string;
  url: string;
  description?: string;
  tags?: string[];
  createdAt: Date;
  schedule?: ScheduleItem[];
} 