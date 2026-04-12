export interface Chapter {
  id: number;
  title: string;
  page_start: number;
  page_end: number;
}

export interface Document {
  id: number;
  filename: string;
  upload_date: string;
  ingested: boolean;
  chapters: Chapter[];
}
