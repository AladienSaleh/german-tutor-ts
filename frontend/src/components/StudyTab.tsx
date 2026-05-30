import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Box, Paper, Typography, TextField, IconButton, Tooltip, CircularProgress, Divider,
} from '@mui/material';
import {
  Send as SendIcon,
  Mic as MicIcon,
  Stop as StopIcon,
  AttachFile as AttachFileIcon,
  VolumeUp as VolumeUpIcon,
  DeleteOutline as ClearIcon,
  Close as CloseIcon,
  AutoAwesome as AIIcon,
} from '@mui/icons-material';
import { useAudioRecorder } from '../hooks/useAudioRecorder.ts';

interface StudyTabProps {
  translationLang: string;
}

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';

interface StudyChatMsg {
  role: 'user' | 'assistant';
  content: string;
  imageBase64?: string;
  imageMime?: string;
  streaming?: boolean;
}

interface AttachedImage {
  base64: string;
  mime: string;
  previewUrl: string;
}

interface SelectionBubble {
  selectedText: string;
  x: number;
  y: number;
  above: boolean;
  translation: string | null;
  loading: boolean;
}

// ── RTL detection ─────────────────────────────────────────────────────────────
function isRtlDominant(text: string): boolean {
  const ar = (text.match(/[؀-ۿ]/g) ?? []).length;
  const lat = (text.match(/[a-zA-Z]/g) ?? []).length;
  return ar > 0 && ar >= lat * 0.4;
}

// ── Markdown container styles ─────────────────────────────────────────────────
const mdSx = {
  fontSize: '0.95rem',
  lineHeight: 1.8,
  '& p': { mb: 0.75, mt: 0, '&:last-child': { mb: 0 } },
  '& h1,& h2': { fontWeight: 700, mt: 2, mb: 0.75, fontSize: '1.1rem', color: 'primary.dark' },
  '& h3': { fontWeight: 700, mt: 1.5, mb: 0.5, fontSize: '1rem', color: 'primary.dark' },
  '& h4,& h5': { fontWeight: 700, mt: 1, mb: 0.5, fontSize: '0.95rem', color: '#1a237e' },
  '& ul,& ol': { pl: 2.5, mb: 0.75, mt: 0 },
  '& li': { mb: 0.4, lineHeight: 1.7 },
  '& strong': { fontWeight: 700, color: '#1a237e' },
  '& em': { fontStyle: 'italic', color: 'text.secondary' },
  '& hr': { my: 1.5, border: 'none', borderTop: '1px solid rgba(0,0,0,0.12)' },
  '& code': {
    bgcolor: 'rgba(0,0,0,0.06)', px: 0.75, py: 0.15,
    borderRadius: 0.75, fontFamily: 'monospace', fontSize: '0.85em',
  },
  '& pre': { bgcolor: 'rgba(0,0,0,0.05)', p: 1.5, borderRadius: 1, overflow: 'auto', mb: 1 },
  '& blockquote': {
    borderLeft: '3px solid', borderColor: 'primary.light',
    pl: 1.5, ml: 0, my: 1, color: 'text.secondary', fontStyle: 'italic',
  },
  '& table': { borderCollapse: 'collapse', width: '100%', mb: 1 },
  '& th,& td': { border: '1px solid rgba(0,0,0,0.15)', px: 1, py: 0.5, textAlign: 'start' },
  '& th': { bgcolor: 'rgba(0,0,0,0.05)', fontWeight: 700 },
};

// ── Context-aware TTS ─────────────────────────────────────────────────────────
function speakText(text: string) {
  window.speechSynthesis.cancel();
  // Strip markdown symbols before speaking
  const clean = text.replace(/#{1,6}\s/g, '').replace(/\*{1,2}/g, '').replace(/^[-*]\s+/gm, '').replace(/---+/g, '');

  const segments: Array<{ text: string; script: 'arabic' | 'latin' }> = [];
  let buf = '';
  let lastScript: 'arabic' | 'latin' | null = null;

  for (const ch of clean) {
    const isAr = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/.test(ch);
    const isLat = /[a-zA-ZäöüßÄÖÜ]/.test(ch);
    const script: 'arabic' | 'latin' | null = isAr ? 'arabic' : isLat ? 'latin' : null;

    if (script && script !== lastScript) {
      if (buf.trim() && lastScript) segments.push({ text: buf, script: lastScript });
      buf = ch;
      lastScript = script;
    } else {
      buf += ch;
    }
  }
  if (buf.trim() && lastScript) segments.push({ text: buf, script: lastScript });

  const arabicContext = segments.some(s => s.script === 'arabic');
  for (const seg of segments) {
    if (!seg.text.trim()) continue;
    const utter = new SpeechSynthesisUtterance(seg.text);
    utter.rate = 0.9;
    utter.lang = seg.script === 'arabic' ? 'ar'
      : (arabicContext || /[äöüßÄÖÜ]/.test(seg.text)) ? 'de-DE' : 'en-US';
    window.speechSynthesis.speak(utter);
  }
}

function speakSelection(text: string) {
  window.speechSynthesis.cancel();
  const isArabic = /[؀-ۿ]/.test(text);
  const utter = new SpeechSynthesisUtterance(text.replace(/\*\*/g, ''));
  utter.lang = isArabic ? 'ar' : 'de-DE';
  utter.rate = 0.85;
  window.speechSynthesis.speak(utter);
}

// ── Welcome message ───────────────────────────────────────────────────────────
const WELCOME: StudyChatMsg = {
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

// ── AssistantMessage component ────────────────────────────────────────────────
const AssistantMessage: React.FC<{ msg: StudyChatMsg }> = ({ msg }) => {
  const rtl = isRtlDominant(msg.content);
  const displayContent = msg.streaming ? msg.content + ' ▌' : msg.content;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      {/* Label row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 0.5 }}>
        <Box sx={{
          width: 22, height: 22, borderRadius: '50%',
          bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <AIIcon sx={{ fontSize: 13, color: 'white' }} />
        </Box>
        <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600, letterSpacing: 0.3 }}>
          Study Assistant
        </Typography>
      </Box>

      {/* Content card */}
      <Box sx={{
        width: '100%',
        bgcolor: '#f0faf2',
        borderRadius: '0 12px 12px 12px',
        border: '1px solid rgba(76,175,80,0.15)',
        px: 2.5, py: 1.75,
        overflow: 'hidden',
      }}>
        {msg.content === '' && msg.streaming ? (
          /* Typing dots */
          <Box sx={{ display: 'flex', gap: '5px', alignItems: 'center', py: 0.5 }}>
            {[0, 1, 2].map(i => (
              <Box key={i} sx={{
                width: 7, height: 7, borderRadius: '50%', bgcolor: 'primary.light',
                animation: 'blink 1.4s infinite both',
                animationDelay: `${i * 0.2}s`,
              }} />
            ))}
          </Box>
        ) : (
          <Box dir={rtl ? 'rtl' : 'ltr'} sx={mdSx}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {displayContent}
            </ReactMarkdown>
          </Box>
        )}
      </Box>

      {/* Speak button */}
      {!msg.streaming && msg.content && (
        <Box sx={{ display: 'flex', px: 0.5 }}>
          <Tooltip title="Read aloud">
            <IconButton size="small" onClick={() => speakText(msg.content)}
              sx={{ opacity: 0.45, '&:hover': { opacity: 1 }, p: 0.5 }}>
              <VolumeUpIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Box>
  );
};

// ── Main StudyTab component ───────────────────────────────────────────────────
export const StudyTab: React.FC<StudyTabProps> = ({ translationLang }) => {
  const [messages, setMessages] = useState<StudyChatMsg[]>([WELCOME]);
  const [inputText, setInputText] = useState('');
  const [attachedImage, setAttachedImage] = useState<AttachedImage | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [textFocused, setTextFocused] = useState(false);
  const [bubble, setBubble] = useState<SelectionBubble | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<StudyChatMsg[]>([WELCOME]);
  const translationLangRef = useRef(translationLang);
  translationLangRef.current = translationLang;
  messagesRef.current = messages;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // ── Selection bubble ──────────────────────────────────────────────────────
  useEffect(() => {
    async function handleMouseUp() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      const text = sel.toString().trim();
      if (text.length < 2) return;

      const range = sel.getRangeAt(0);
      if (!chatAreaRef.current?.contains(range.commonAncestorContainer)) return;

      const rect = range.getBoundingClientRect();
      const above = rect.top > 120;
      setBubble({ selectedText: text, x: rect.left + rect.width / 2, y: above ? rect.top : rect.bottom, above, translation: null, loading: true });

      try {
        const res = await fetch(`${API_BASE}/api/study/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, targetLang: translationLangRef.current }),
        });
        const data = await res.json() as { translation: string };
        setBubble(prev => prev?.selectedText === text ? { ...prev, translation: data.translation, loading: false } : prev);
      } catch {
        setBubble(prev => prev ? { ...prev, loading: false } : null);
      }
    }

    function handleMouseDown(e: MouseEvent) {
      if ((e.target as Element).closest('[data-bubble]')) return;
      setBubble(null);
    }

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  // ── Image helpers ─────────────────────────────────────────────────────────
  function attachImageFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setAttachedImage({ base64: dataUrl.split(',')[1], mime: file.type, previewUrl: dataUrl });
    };
    reader.readAsDataURL(file);
  }

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const imageItem = Array.from(e.clipboardData.items).find(i => i.type.startsWith('image/'));
    if (imageItem) {
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (file) attachImageFile(file);
    }
  }, []);

  // ── Core send logic ───────────────────────────────────────────────────────
  const sendMessage = useCallback(async (opts: {
    userText?: string;
    audioBase64?: string;
    imageBase64?: string;
    imageMime?: string;
  }) => {
    const {
      userText = inputText,
      audioBase64,
      imageBase64 = attachedImage?.base64,
      imageMime = attachedImage?.mime,
    } = opts;
    const trimmed = (userText ?? '').trim();
    if (!trimmed && !audioBase64 && !imageBase64) return;
    if (isGenerating) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const history = messagesRef.current.filter(m => !m.streaming);
    let historyForRequest = history;

    if (!audioBase64) {
      const userMsg: StudyChatMsg = { role: 'user', content: trimmed, imageBase64, imageMime };
      setMessages(prev => [...prev, userMsg, { role: 'assistant', content: '', streaming: true }]);
      historyForRequest = [...history, userMsg];
    } else {
      setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }]);
    }

    setInputText('');
    setAttachedImage(null);
    setIsGenerating(true);

    try {
      const resp = await fetch(`${API_BASE}/api/study/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: historyForRequest.map(m => ({ role: m.role, content: m.content })),
          userText: trimmed,
          audioBase64,
          imageBase64,
          imageMime,
        }),
        signal: abortRef.current.signal,
      });

      if (!resp.ok || !resp.body) throw new Error(`Server error: ${resp.status}`);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let transcriptInserted = false;

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') break outer;

          let event: { type: string; text?: string };
          try { event = JSON.parse(raw); } catch { continue; }

          if (event.type === 'transcript' && !transcriptInserted) {
            transcriptInserted = true;
            const userMsg: StudyChatMsg = { role: 'user', content: event.text!, imageBase64, imageMime };
            setMessages(prev => [...prev.slice(0, -1), userMsg, { role: 'assistant', content: '', streaming: true }]);
          } else if (event.type === 'token') {
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === 'assistant' && last.streaming) {
                return [...prev.slice(0, -1), { ...last, content: last.content + event.text! }];
              }
              return prev;
            });
          } else if (event.type === 'error') {
            throw new Error(event.text);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          const errMsg = { role: 'assistant' as const, content: `⚠ ${(err as Error).message}` };
          return last?.role === 'assistant' && last.streaming
            ? [...prev.slice(0, -1), errMsg]
            : [...prev, errMsg];
        });
      }
    } finally {
      setMessages(prev => prev.map(m => m.streaming ? { ...m, streaming: false } : m));
      setIsGenerating(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputText, attachedImage, isGenerating]);

  // ── Audio ─────────────────────────────────────────────────────────────────
  const handleAudioReady = useCallback((blob: Blob) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      void sendMessage({ audioBase64: (reader.result as string).split(',')[1] });
    };
    reader.readAsDataURL(blob);
  }, [sendMessage]);

  const { isRecording, audioLevel, startRecording, stopRecording } = useAudioRecorder(
    handleAudioReady,
    !isGenerating && !textFocused,
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage({}); }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      {/* Top bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', px: 1.5, py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Tooltip title="Clear conversation">
          <IconButton size="small" onClick={() => setMessages([WELCOME])} disabled={isGenerating}>
            <ClearIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Messages */}
      <Box
        ref={chatAreaRef}
        sx={{ flexGrow: 1, minHeight: 0, overflowY: 'auto', px: { xs: 1.5, sm: 2.5 }, py: 2, display: 'flex', flexDirection: 'column', gap: 2.5 }}
      >
        {messages.map((m, i) => {
          if (m.role === 'assistant') {
            return <AssistantMessage key={i} msg={m} />;
          }

          // User message
          const rtl = isRtlDominant(m.content);
          return (
            <Box key={i} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
              {m.imageBase64 && (
                <Box
                  component="img"
                  src={`data:${m.imageMime ?? 'image/jpeg'};base64,${m.imageBase64}`}
                  alt="attached"
                  sx={{ maxWidth: 240, maxHeight: 180, borderRadius: 2, border: '1px solid', borderColor: 'divider', objectFit: 'cover' }}
                />
              )}
              <Paper elevation={0} sx={{
                px: 2, py: 1.25, maxWidth: '80%',
                bgcolor: '#e8f4fd',
                borderRadius: '16px 16px 4px 16px',
                border: '1px solid rgba(33,150,243,0.15)',
              }}>
                <Typography variant="body1" dir={rtl ? 'rtl' : 'ltr'} sx={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {m.content || <em style={{ opacity: 0.5 }}>…</em>}
                </Typography>
              </Paper>
            </Box>
          );
        })}

        <div ref={bottomRef} />
      </Box>

      <Divider />

      {/* Input area */}
      <Box sx={{ px: 1.5, pt: 1, pb: 1.25 }}>
        {/* Image preview */}
        {attachedImage && (
          <Box sx={{ position: 'relative', display: 'inline-block', mb: 1 }}>
            <Box component="img" src={attachedImage.previewUrl} alt="To attach"
              sx={{ maxWidth: 130, maxHeight: 90, borderRadius: 1.5, border: '1px solid', borderColor: 'divider', objectFit: 'cover', display: 'block' }} />
            <IconButton size="small" onClick={() => setAttachedImage(null)}
              sx={{ position: 'absolute', top: -8, right: -8, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', p: 0.25 }}>
              <CloseIcon sx={{ fontSize: 13 }} />
            </IconButton>
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-end' }}>
          <Tooltip title="Attach image (or paste Ctrl+V)">
            <IconButton size="small" onClick={() => fileInputRef.current?.click()} disabled={isGenerating} sx={{ mb: 0.25 }}>
              <AttachFileIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <input ref={fileInputRef} type="file" accept="image/*" hidden
            onChange={e => { if (e.target.files?.[0]) attachImageFile(e.target.files[0]); e.target.value = ''; }} />

          <TextField
            multiline maxRows={5} fullWidth size="small" variant="outlined"
            placeholder="اسأل سؤالاً... / Frag mich... (Shift+Enter for new line)"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onFocus={() => setTextFocused(true)}
            onBlur={() => setTextFocused(false)}
            disabled={isGenerating}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5, fontSize: '0.95rem' } }}
          />

          {isRecording ? (
            <Tooltip title="Stop recording">
              <IconButton color="error" onClick={stopRecording} sx={{
                mb: 0.25, bgcolor: 'error.main', color: 'white', '&:hover': { bgcolor: 'error.dark' },
                boxShadow: `0 0 0 ${Math.round(audioLevel * 12)}px rgba(211,47,47,0.2)`,
                transition: 'box-shadow 0.1s',
              }}>
                <StopIcon />
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip title="Hold to record (or press Space)">
              <span>
                <IconButton color="primary" onMouseDown={startRecording} onMouseUp={stopRecording}
                  onTouchStart={startRecording} onTouchEnd={stopRecording}
                  disabled={isGenerating} sx={{ mb: 0.25 }}>
                  <MicIcon />
                </IconButton>
              </span>
            </Tooltip>
          )}

          <Tooltip title="Send (Enter)">
            <span>
              <IconButton
                onClick={() => void sendMessage({})}
                disabled={isGenerating || (!inputText.trim() && !attachedImage)}
                sx={{
                  mb: 0.25, bgcolor: 'primary.main', color: 'white',
                  '&:hover': { bgcolor: 'primary.dark' },
                  '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'text.disabled' },
                }}
              >
                {isGenerating
                  ? <CircularProgress size={20} sx={{ color: 'primary.main' }} />
                  : <SendIcon />}
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      {/* Selection translation bubble */}
      {bubble && (
        <Paper data-bubble elevation={8} sx={{
          position: 'fixed',
          left: bubble.x,
          top: bubble.above ? bubble.y - 8 : bubble.y + 8,
          transform: bubble.above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
          zIndex: 9999,
          px: 1.5, py: 0.75,
          maxWidth: 340, minWidth: 100,
          borderRadius: 2,
          display: 'flex', alignItems: 'center', gap: 0.75,
          boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
          border: '1px solid rgba(0,0,0,0.08)',
        }}>
          {bubble.loading ? (
            <CircularProgress size={16} sx={{ mx: 0.5 }} />
          ) : (
            <Typography variant="body2"
              dir={/[؀-ۿ]/.test(bubble.translation ?? '') ? 'rtl' : 'ltr'}
              sx={{ flexGrow: 1, lineHeight: 1.5, fontSize: '0.85rem' }}>
              {bubble.translation ?? '—'}
            </Typography>
          )}
          <Tooltip title="Pronounce original">
            <IconButton size="small" onClick={() => speakSelection(bubble.selectedText)} sx={{ flexShrink: 0, p: 0.5 }}>
              <VolumeUpIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
          <IconButton size="small" onClick={() => setBubble(null)} sx={{ flexShrink: 0, p: 0.5, opacity: 0.45 }}>
            <CloseIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Paper>
      )}
    </Box>
  );
};
