export interface Station {
  id: string;
  title: string;
  url: string;
  description?: string;
  tags?: string[];
  createdAt: Date;
} 