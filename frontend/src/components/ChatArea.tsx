import React, { useEffect, useRef } from 'react';
import { Box, Paper, Typography, Chip } from '@mui/material';
import { Translate as TranslateIcon } from '@mui/icons-material';

export interface Message {
  type: 'user' | 'lina' | 'correction';
  text: string;
  lang?: string;
  streaming?: boolean;
}

interface TypingIndicatorProps { show: boolean }

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ show }) => {
  if (!show) return null;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1 }}>
      <Box sx={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        {[0, 1, 2].map(i => (
          <Box key={i} sx={{
            width: 7, height: 7, borderRadius: '50%', bgcolor: 'primary.light',
            animation: 'blink 1.4s infinite both',
            animationDelay: `${i * 0.2}s`,
          }} />
        ))}
      </Box>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>Lina is typing…</Typography>
    </Box>
  );
};

function isRtl(text: string): boolean {
  return /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/.test(text);
}

interface ChatAreaProps {
  messages: Message[];
  isTyping: boolean;
}

export const ChatArea: React.FC<ChatAreaProps> = ({ messages, isTyping }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  return (
    <Box className="chat-scroll" sx={{ flexGrow: 1, px: 2, py: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {messages.map((m, i) => {
        if (m.type === 'correction') {
          return (
            <Box key={i} sx={{ display: 'flex', justifyContent: 'center', my: 0.5 }}>
              <Chip
                icon={<TranslateIcon />}
                label={m.text}
                color="warning"
                variant="outlined"
                sx={{ fontWeight: 600, borderStyle: 'dashed', maxWidth: '90%', height: 'auto',
                      '& .MuiChip-label': { whiteSpace: 'normal', py: 0.5 } }}
              />
            </Box>
          );
        }

        const isUser = m.type === 'user';
        const rtl = isUser && isRtl(m.text);

        return (
          <Box key={i} sx={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
            <Paper sx={{
              px: 2, py: 1.25, maxWidth: '78%',
              bgcolor: isUser ? '#e3f2fd' : '#f1f8e9',
              borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              border: 'none',
            }}>
              <Typography
                variant="body1"
                dir={rtl ? 'rtl' : 'ltr'}
                sx={{ ...(m.streaming && { '&::after': { content: '"▋"', animation: 'blink 0.8s step-start infinite' } }) }}
              >
                {m.text}
              </Typography>
              {m.lang && (
                <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 0.25 }}>
                  {m.lang}
                </Typography>
              )}
            </Paper>
          </Box>
        );
      })}

      <TypingIndicator show={isTyping} />
      <div ref={bottomRef} />
    </Box>
  );
};
