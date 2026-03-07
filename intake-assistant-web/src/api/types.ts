export interface Question {
  id: string;
  title: string;
  description: string;
  placeholder?: string;
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
  answer: string;
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

// SSE streaming types
export interface StatusData {
  phase: "generating" | "validating" | "retry" | "analyzing";
  attempt?: number;
  max_attempts?: number;
  reason?: string;
}

export interface ChunkData {
  text: string;
}

export type ResultData = GenerateResponse;

export interface ErrorData {
  message: string;
}

export type StreamEvent =
  | { event: "status"; data: StatusData }
  | { event: "chunk"; data: ChunkData }
  | { event: "result"; data: ResultData }
  | { event: "error"; data: ErrorData };

export type AnalyzeStreamEvent =
  | { event: "status"; data: StatusData }
  | { event: "chunk"; data: ChunkData }
  | { event: "result"; data: AnalyzeResponse }
  | { event: "error"; data: ErrorData };
