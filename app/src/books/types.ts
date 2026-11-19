export interface Chapter { title: string; bite: number }

export interface BookData {
  id: string;
  title: string;
  author: string;
  bites: string[];
  chapters: Chapter[];
}

export interface BookMeta {
  id: string;
  title: string;
  author: string;
  total: number;
  imported: boolean;
}
