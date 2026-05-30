import React from 'react';
import { Box, Fab, Typography } from '@mui/material';
import { Mic as MicIcon, Stop as StopIcon, HourglassEmpty as SpinIcon } from '@mui/icons-material';

type AppState = 'idle' | 'recording' | 'processing' | 'speaking';

interface RecordButtonProps {
  appState: AppState;
  audioLevel: number;
  onPress: () => void;
  onRelease: () => void;
  disabled: boolean;
}

const WAVE_ANIMS = ['wave1', 'wave2', 'wave3', 'wave4', 'wave5'];

const LABELS: Record<AppState, string> = {
  idle:       'Hold Space or tap to speak',
  recording:  'Listening… release when done',
  processing: 'Processing…',
  speaking:   'Lina is speaking',
};

export const RecordButton: React.FC<RecordButtonProps> = ({
  appState, audioLevel, onPress, onRelease, disabled,
}) => {
  const isRecording = appState === 'recording';
  const isProcessing = appState === 'processing';
  const isSpeaking = appState === 'speaking';

  const fabColor = isRecording ? 'secondary' : 'primary';
  const fabSx = {
    width: 80, height: 80, position: 'relative' as const,
    ...(isRecording && { animation: 'pulse-ring 1.5s infinite' }),
    ...(isProcessing && { opacity: 0.6 }),
  };

  const barCount = 5;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, pb: 2 }}>
      <Box sx={{ position: 'relative', width: 80, height: 80 }}>
        <Fab
          color={fabColor}
          sx={fabSx}
          disabled={disabled}
          onMouseDown={onPress}
          onMouseUp={onRelease}
          onTouchStart={(e) => { e.preventDefault(); onPress(); }}
          onTouchEnd={(e) => { e.preventDefault(); onRelease(); }}
        >
          {isProcessing
            ? <SpinIcon sx={{ fontSize: 36, animation: 'spin 1s linear infinite', '@keyframes spin': { to: { transform: 'rotate(360deg)' } } }} />
            : isRecording
            ? <StopIcon sx={{ fontSize: 36 }} />
            : <MicIcon sx={{ fontSize: 36 }} />
          }
        </Fab>
      </Box>

      {/* Waveform bars — shown while recording (live) or speaking (animated) */}
      {(isRecording || isSpeaking) && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '3px', height: 32 }}>
          {Array.from({ length: barCount }, (_, i) => {
            const liveHeight = isRecording
              ? Math.max(4, audioLevel * 28 * (0.6 + Math.sin(i * 1.3) * 0.4))
              : undefined;
            return (
              <Box
                key={i}
                sx={{
                  width: 4,
                  borderRadius: 2,
                  bgcolor: isRecording ? 'secondary.main' : 'primary.light',
                  height: liveHeight ? `${liveHeight}px` : undefined,
                  ...(isSpeaking && {
                    animation: `${WAVE_ANIMS[i]} ${0.8 + i * 0.1}s ease-in-out infinite`,
                    animationDelay: `${i * 0.08}s`,
                  }),
                }}
              />
            );
          })}
        </Box>
      )}

      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
        {LABELS[appState]}
      </Typography>
    </Box>
  );
};
