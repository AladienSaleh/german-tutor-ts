import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Box, Paper, Typography, TextField, IconButton, Tooltip, CircularProgress,
} from '@mui/material';
import {
  Send as SendIcon,
  Mic as MicIcon,
  Stop as StopIcon,
  AttachFile as AttachFileIcon,
  VolumeUp as VolumeUpIcon,
  DeleteOutline as ClearIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useAudioRecorder } from '../hooks/useAudioRecorder.ts';

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

// ── Minimal inline markdown (bold + line breaks) ──────────────────────────────
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*\n]+\*\*)/g);
  const nodes: React.ReactNode[] = [];
  parts.forEach((part, pi) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      nodes.push(<strong key={pi}>{part.slice(2, -2)}</strong>);
    } else {
      part.split('\n').forEach((line, li) => {
        if (li > 0) nodes.push(<br key={`${pi}-br-${li}`} />);
        // Bullet list items
        const trimmed = line.replace(/^[-•]\s+/, '');
        if (trimmed !== line) {
          nodes.push(
            <Box key={`${pi}-${li}`} component="span" sx={{ display: 'block', pl: 1 }}>
              {'• '}{trimmed}
            </Box>,
          );
        } else {
          nodes.push(<React.Fragment key={`${pi}-${li}`}>{line}</React.Fragment>);
        }
      });
    }
  });
  return <>{nodes}</>;
}

// ── Context-aware TTS: splits text into Arabic / Latin runs ──────────────────
function speakText(text: string) {
  window.speechSynthesis.cancel();
  const clean = text.replace(/\*\*/g, '').replace(/^[-•]\s*/gm, '');

  // Walk character-by-character, grouping by script
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

  // If there's any Arabic in the response, assume Latin segments are German
  // (the AI mixes Arabic explanations with German vocabulary)
  const arabicContext = segments.some(s => s.script === 'arabic');

  for (const seg of segments) {
    if (!seg.text.trim()) continue;
    const utter = new SpeechSynthesisUtterance(seg.text);
    utter.rate = 0.9;
    if (seg.script === 'arabic') {
      utter.lang = 'ar';
    } else {
      // Has German umlauts → German; in Arabic context → German (learning German);
      // otherwise English
      utter.lang = (arabicContext || /[äöüßÄÖÜ]/.test(seg.text)) ? 'de-DE' : 'en-US';
    }
    window.speechSynthesis.speak(utter);
  }
}

function isRtlText(text: string): boolean {
  return /[؀-ۿ]/.test(text.slice(0, 80));
}

const WELCOME: StudyChatMsg = {
  role: 'assistant',
  content:
    'مرحباً! أنا مساعدك للدراسة.\n\n' +
    'يمكنني مساعدتك في:\n' +
    '- الترجمة بين العربية والألمانية والإنجليزية\n' +
    '- شرح قواعد اللغة الألمانية بالعربية\n' +
    '- تحليل الصور من كتبك أو دوراتك\n' +
    '- الإجابة عن أي سؤال بلغة التعلم\n\n' +
    'ابدأ بكتابة سؤالك، أو الصق صورة (Ctrl+V)، أو سجّل صوتك!',
};

// ── Main StudyTab component ───────────────────────────────────────────────────
export const StudyTab: React.FC = () => {
  const [messages, setMessages] = useState<StudyChatMsg[]>([WELCOME]);
  const [inputText, setInputText] = useState('');
  const [attachedImage, setAttachedImage] = useState<AttachedImage | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [textFocused, setTextFocused] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<StudyChatMsg[]>([WELCOME]);

  // Keep ref in sync
  messagesRef.current = messages;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // ── Image helpers ─────────────────────────────────────────────────────────
  function attachImageFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    const mime = file.type;
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      setAttachedImage({ base64, mime, previewUrl: dataUrl });
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
    const { userText = inputText, audioBase64, imageBase64 = attachedImage?.base64, imageMime = attachedImage?.mime } = opts;
    const trimmed = (userText ?? '').trim();

    if (!trimmed && !audioBase64 && !imageBase64) return;
    if (isGenerating) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    // For text/image: add user message immediately
    // For audio: wait for transcript event
    const history = messagesRef.current.filter(m => !m.streaming);
    let historyForRequest = history;

    if (!audioBase64) {
      const userMsg: StudyChatMsg = { role: 'user', content: trimmed, imageBase64, imageMime };
      setMessages(prev => [...prev, userMsg, { role: 'assistant', content: '', streaming: true }]);
      historyForRequest = [...history, userMsg];
    } else {
      // Placeholder assistant message — user message will be inserted on transcript event
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

      if (!resp.ok || !resp.body) {
        throw new Error(`Server error: ${resp.status}`);
      }

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
            // Insert user message before the streaming assistant bubble
            setMessages(prev => {
              const rest = prev.slice(0, -1); // remove streaming assistant
              return [...rest, userMsg, { role: 'assistant', content: '', streaming: true }];
            });
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
          if (last?.role === 'assistant' && last.streaming) {
            return [...prev.slice(0, -1), { ...last, content: `⚠ ${(err as Error).message}`, streaming: false }];
          }
          return [...prev, { role: 'assistant', content: `⚠ ${(err as Error).message}` }];
        });
      }
    } finally {
      setMessages(prev => prev.map(m => m.streaming ? { ...m, streaming: false } : m));
      setIsGenerating(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputText, attachedImage, isGenerating]);

  // ── Audio recording ───────────────────────────────────────────────────────
  const handleAudioReady = useCallback((blob: Blob) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const b64 = (reader.result as string).split(',')[1];
      void sendMessage({ audioBase64: b64 });
    };
    reader.readAsDataURL(blob);
  }, [sendMessage]);

  const { isRecording, audioLevel, startRecording, stopRecording } = useAudioRecorder(
    handleAudioReady,
    !isGenerating && !textFocused,
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage({});
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      {/* Toolbar */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 1.5, pt: 1 }}>
        <Tooltip title="Clear conversation">
          <IconButton size="small" onClick={() => setMessages([WELCOME])} disabled={isGenerating}>
            <ClearIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Messages */}
      <Box sx={{ flexGrow: 1, minHeight: 0, overflowY: 'auto', px: 2, pb: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {messages.map((m, i) => {
          const isUser = m.role === 'user';
          const rtl = isRtlText(m.content);

          return (
            <Box key={i} sx={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
              {/* Image thumbnail (user messages) */}
              {isUser && m.imageBase64 && (
                <Box
                  component="img"
                  src={`data:${m.imageMime ?? 'image/jpeg'};base64,${m.imageBase64}`}
                  alt="attached"
                  sx={{ maxWidth: 220, maxHeight: 160, borderRadius: 2, mb: 0.5, border: '1px solid', borderColor: 'divider', objectFit: 'cover' }}
                />
              )}

              <Paper elevation={0} sx={{
                px: 2, py: 1.25, maxWidth: '82%',
                bgcolor: isUser ? '#e3f2fd' : '#f1f8e9',
                borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              }}>
                <Typography
                  variant="body1"
                  dir={rtl ? 'rtl' : 'ltr'}
                  component="div"
                  sx={{
                    lineHeight: 1.65,
                    ...(m.streaming && {
                      '&::after': { content: '"▋"', animation: 'blink 0.8s step-start infinite' },
                    }),
                  }}
                >
                  <RichText text={m.content} />
                </Typography>
              </Paper>

              {/* Speak button on finished assistant messages */}
              {!isUser && !m.streaming && m.content && (
                <Tooltip title="Read aloud">
                  <IconButton size="small" sx={{ mt: 0.25, opacity: 0.5, '&:hover': { opacity: 1 } }} onClick={() => speakText(m.content)}>
                    <VolumeUpIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          );
        })}

        {isGenerating && messages[messages.length - 1]?.content === '' && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', px: 1 }}>
            {[0, 1, 2].map(i => (
              <Box key={i} sx={{
                width: 7, height: 7, borderRadius: '50%', bgcolor: 'primary.light',
                animation: 'blink 1.4s infinite both',
                animationDelay: `${i * 0.2}s`,
              }} />
            ))}
          </Box>
        )}

        <div ref={bottomRef} />
      </Box>

      {/* Input area */}
      <Box sx={{ borderTop: '1px solid', borderColor: 'divider', px: 1.5, pt: 1, pb: 1.5 }}>

        {/* Attached image preview */}
        {attachedImage && (
          <Box sx={{ position: 'relative', display: 'inline-block', mb: 1 }}>
            <Box
              component="img"
              src={attachedImage.previewUrl}
              alt="To attach"
              sx={{ maxWidth: 140, maxHeight: 100, borderRadius: 2, border: '1px solid', borderColor: 'divider', objectFit: 'cover', display: 'block' }}
            />
            <IconButton
              size="small"
              onClick={() => setAttachedImage(null)}
              sx={{ position: 'absolute', top: -8, right: -8, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', p: 0.25 }}
            >
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
          {/* Image attach */}
          <Tooltip title="Attach image (or paste Ctrl+V)">
            <IconButton size="small" onClick={() => fileInputRef.current?.click()} disabled={isGenerating}>
              <AttachFileIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={e => { if (e.target.files?.[0]) attachImageFile(e.target.files[0]); e.target.value = ''; }}
          />

          {/* Text input */}
          <TextField
            multiline
            maxRows={5}
            fullWidth
            size="small"
            variant="outlined"
            placeholder="اسأل أي سؤال... / Frag mich etwas... (Shift+Enter for new line)"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onFocus={() => setTextFocused(true)}
            onBlur={() => setTextFocused(false)}
            disabled={isGenerating}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
          />

          {/* Mic / Stop */}
          {isRecording ? (
            <Tooltip title="Stop recording">
              <IconButton
                color="error"
                onClick={stopRecording}
                sx={{
                  bgcolor: 'error.main', color: 'white',
                  '&:hover': { bgcolor: 'error.dark' },
                  position: 'relative',
                  '&::after': {
                    content: '""',
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    bgcolor: 'error.main',
                    transform: `scale(${1 + audioLevel * 0.5})`,
                    opacity: 0.3,
                    transition: 'transform 0.1s',
                    zIndex: -1,
                  },
                }}
              >
                <StopIcon />
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip title="Hold to record voice (or press Space)">
              <span>
                <IconButton
                  color="primary"
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onTouchStart={startRecording}
                  onTouchEnd={stopRecording}
                  disabled={isGenerating}
                >
                  <MicIcon />
                </IconButton>
              </span>
            </Tooltip>
          )}

          {/* Send */}
          <Tooltip title="Send (Enter)">
            <span>
              <IconButton
                color="primary"
                onClick={() => void sendMessage({})}
                disabled={isGenerating || (!inputText.trim() && !attachedImage)}
                sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' }, '&.Mui-disabled': { bgcolor: 'action.disabledBackground' } }}
              >
                {isGenerating ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
};
