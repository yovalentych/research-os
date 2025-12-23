export const knowledgeBaseCategories = [
  "Протокол",
  "Інструкція",
  "Методика",
  "SOP",
  "Нотатка",
  "Safety",
] as const;
export type KnowledgeBaseCategory = (typeof knowledgeBaseCategories)[number];
