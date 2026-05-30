export interface StudyChatMsg {
  role: 'user' | 'assistant';
  content: string;
  imageBase64?: string;
  imageMime?: string;
  audioFileName?: string;
  audioPreviewUrl?: string;
  streaming?: boolean;
}

export interface ThreadMeta {
  id: string;
  title: string;          // 'New conversation' until AI generates one
  titleGenerated: boolean;
  createdAt: number;
  updatedAt: number;
  preview: string;        // snippet of last message
  messageCount: number;
}
