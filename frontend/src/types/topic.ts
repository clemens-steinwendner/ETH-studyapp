export interface Topic {
  title: string;
  subtopics: string[];
}

export interface SubjectTopicList {
  subject: string;
  topics: Topic[];
  generated_at: string;
  source_doc_ids: number[];
}
