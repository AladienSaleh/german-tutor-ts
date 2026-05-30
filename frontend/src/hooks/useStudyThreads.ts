import { useState, useCallback, useRef } from 'react';
import type { StudyChatMsg, ThreadMeta } from '../types/study.ts';

const INDEX_KEY = 'study_threads_v2';
const msgKey = (id: string) => `study_thread_${id}`;
const MAX_MSG = 120;

// ── Welcome message (first thread seed) ──────────────────────────────────────
export const WELCOME_MSG: StudyChatMsg = {
  role: 'assistant',
  content:
    'مرحباً! أنا مساعدك للدراسة 📚\n\n' +
    'يمكنني مساعدتك في:\n' +
    '- **الترجمة** بين العربية والألمانية والإنجليزية\n' +
    '- **شرح قواعد** اللغة الألمانية بالعربية\n' +
    '- **تحليل الصور** من كتبك أو دوراتك (الصق بـ Ctrl+V)\n' +
    '- **الإجابة** عن أي سؤال\n\n' +
    '*تلميح: حدّد أي نص لترجمته فوراً!*',
};

// ── Storage helpers ───────────────────────────────────────────────────────────
function loadIndex(): ThreadMeta[] {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) ?? '[]') as ThreadMeta[];
  } catch { return []; }
}

function saveIndex(idx: ThreadMeta[]) {
  try { localStorage.setItem(INDEX_KEY, JSON.stringify(idx)); } catch { /* quota */ }
}

function loadMessages(id: string): StudyChatMsg[] {
  try {
    const msgs = JSON.parse(localStorage.getItem(msgKey(id)) ?? '[]') as StudyChatMsg[];
    return msgs.length > 0 ? msgs : [WELCOME_MSG];
  } catch { return [WELCOME_MSG]; }
}

function persistMessages(id: string, msgs: StudyChatMsg[]) {
  const clean = msgs
    .filter(m => !m.streaming)
    .slice(-MAX_MSG)
    .map(({ audioPreviewUrl: _p, streaming: _s, ...m }) => m);
  try {
    localStorage.setItem(msgKey(id), JSON.stringify(clean));
  } catch {
    try {
      const slim = clean.map(({ imageBase64: _i, ...m }) => m);
      localStorage.setItem(msgKey(id), JSON.stringify(slim));
    } catch { /* give up */ }
  }
}

function makeId() { return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`; }

function makePreview(msgs: StudyChatMsg[]): string {
  const last = [...msgs].reverse().find(m => m.content.trim());
  return last?.content.replace(/[#*`_]/g, '').trim().slice(0, 90) ?? '';
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useStudyThreads() {
  const [index, setIndex] = useState<ThreadMeta[]>(() => {
    const idx = loadIndex();
    if (idx.length === 0) {
      // Bootstrap: create first thread with welcome message
      const id = makeId();
      const meta: ThreadMeta = {
        id, title: 'New conversation', titleGenerated: false,
        createdAt: Date.now(), updatedAt: Date.now(),
        preview: '', messageCount: 1,
      };
      persistMessages(id, [WELCOME_MSG]);
      saveIndex([meta]);
      return [meta];
    }
    return idx;
  });

  const [currentId, setCurrentId] = useState<string>(() => {
    const idx = loadIndex();
    return idx[0]?.id ?? makeId();
  });

  const [messages, setMessages] = useState<StudyChatMsg[]>(() => {
    const idx = loadIndex();
    return idx.length > 0 ? loadMessages(idx[0].id) : [WELCOME_MSG];
  });

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Save messages for the current thread and update index metadata
  const saveMessages = useCallback((msgs: StudyChatMsg[], id = currentId) => {
    persistMessages(id, msgs);
    setIndex(prev => {
      const updated = prev.map(t =>
        t.id === id
          ? { ...t, updatedAt: Date.now(), preview: makePreview(msgs), messageCount: msgs.filter(m => !m.streaming).length }
          : t,
      );
      // Sort newest first
      updated.sort((a, b) => b.updatedAt - a.updatedAt);
      saveIndex(updated);
      return updated;
    });
  }, [currentId]);

  // Switch to a different thread (saves current first)
  const switchThread = useCallback((id: string) => {
    saveMessages(messagesRef.current);
    setCurrentId(id);
    setMessages(loadMessages(id));
  }, [saveMessages]);

  // Create a new thread and switch to it
  const newThread = useCallback(() => {
    saveMessages(messagesRef.current);
    const id = makeId();
    const meta: ThreadMeta = {
      id, title: 'New conversation', titleGenerated: false,
      createdAt: Date.now(), updatedAt: Date.now(),
      preview: '', messageCount: 1,
    };
    persistMessages(id, [WELCOME_MSG]);
    setIndex(prev => {
      const updated = [meta, ...prev];
      saveIndex(updated);
      return updated;
    });
    setCurrentId(id);
    setMessages([WELCOME_MSG]);
  }, [saveMessages]);

  // Update a thread's AI-generated title
  const setTitle = useCallback((id: string, title: string) => {
    setIndex(prev => {
      const updated = prev.map(t =>
        t.id === id ? { ...t, title, titleGenerated: true } : t,
      );
      saveIndex(updated);
      return updated;
    });
  }, []);

  // Delete a thread (switch to next one or create blank)
  const deleteThread = useCallback((id: string) => {
    const key = msgKey(id);
    try { localStorage.removeItem(key); } catch { /* ignore */ }

    setIndex(prev => {
      const updated = prev.filter(t => t.id !== id);
      saveIndex(updated);

      if (id === currentId) {
        if (updated.length > 0) {
          const nextId = updated[0].id;
          setCurrentId(nextId);
          setMessages(loadMessages(nextId));
        } else {
          // Last thread deleted — create a fresh one
          const newId = makeId();
          const meta: ThreadMeta = {
            id: newId, title: 'New conversation', titleGenerated: false,
            createdAt: Date.now(), updatedAt: Date.now(),
            preview: '', messageCount: 1,
          };
          persistMessages(newId, [WELCOME_MSG]);
          saveIndex([meta]);
          setCurrentId(newId);
          setMessages([WELCOME_MSG]);
          return [meta];
        }
      }
      return updated;
    });
  }, [currentId]);

  return {
    threads: index,
    currentId,
    messages,
    setMessages,
    saveMessages,
    switchThread,
    newThread,
    setTitle,
    deleteThread,
  };
}
