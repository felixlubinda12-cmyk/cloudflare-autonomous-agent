export interface GeminiPart {
  text?: string;
  thought?: boolean;
  thoughtSignature?: string;
  thought_signature?: string;
  functionCall?: {
    name: string;
    args: Record<string, unknown>;
  };
  functionResponse?: {
    name: string;
    response: Record<string, unknown>;
  };
  [key: string]: unknown;
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export interface GeminiToolCall {
  name: string;
  args: Record<string, unknown>;
  part?: GeminiPart;
  thoughtSignature?: string;
  thought_signature?: string;
}

export interface GeminiResponse {
  text?: string;
  toolCalls?: GeminiToolCall[];
  candidateParts?: GeminiPart[];
  finishReason?: string;
}
