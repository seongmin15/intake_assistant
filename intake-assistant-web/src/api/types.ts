export interface Choice {
  id: string;
  label: string;
}

export interface Question {
  id: string;
  title: string;
  description: string;
  type: "single" | "multi";
  choices: Choice[];
}

export interface Analysis {
  detected_keywords: string[];
  inferred_hints: Record<string, string>;
}

export interface AnalyzeResponse {
  questions: Question[];
  analysis: Analysis;
}

export interface QaAnswer {
  question_id: string;
  selected_ids: string[];
}

export interface ArchitectureCard {
  service_composition: string;
  data_storage: string;
  authentication: string;
  external_services: string;
  screen_count: string;
}

export interface FeatureItem {
  name: string;
  summary: string;
}

export interface GenerateResponse {
  yaml_content: string;
  architecture_card: ArchitectureCard;
  feature_checklist: FeatureItem[];
}
