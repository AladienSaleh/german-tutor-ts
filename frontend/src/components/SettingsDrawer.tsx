import React, { useEffect, useState } from 'react';
import {
  Drawer, Box, Typography, Divider, IconButton,
  List, ListItem, ListItemText, Chip, CircularProgress,
} from '@mui/material';
import { Close as CloseIcon, Settings as SettingsIcon } from '@mui/icons-material';

interface ServerConfig {
  llm: { provider: string; model: string };
  stt: { provider: string; model: string };
  tts: { provider: string };
}

interface LatencyStats {
  sttMs: number;
  ttsMs: number;
}

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  latency: LatencyStats | null;
  onChangeScenario: () => void;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({ open, onClose, latency, onChangeScenario }) => {
  const [cfg, setCfg] = useState<ServerConfig | null>(null);

  useEffect(() => {
    if (!open) return;
    const apiBase = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';
    fetch(`${apiBase}/api/config`)
      .then(r => r.json())
      .then(setCfg)
      .catch(() => {});
  }, [open]);

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: 300 } }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SettingsIcon color="primary" />
          <Typography variant="h6" fontWeight={700}>Settings</Typography>
        </Box>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </Box>

      <Divider />

      <Box sx={{ p: 2 }}>
        <Typography variant="overline" color="text.secondary">Providers</Typography>
        {cfg ? (
          <List dense disablePadding>
            <ListItem disableGutters>
              <ListItemText primary="LLM" secondary={`${cfg.llm.provider} / ${cfg.llm.model}`} />
              <Chip label={cfg.llm.provider} size="small" color="primary" variant="outlined" />
            </ListItem>
            <ListItem disableGutters>
              <ListItemText primary="STT" secondary={`${cfg.stt.provider} / ${cfg.stt.model}`} />
              <Chip label={cfg.stt.provider} size="small" color="primary" variant="outlined" />
            </ListItem>
            <ListItem disableGutters>
              <ListItemText primary="TTS" secondary={cfg.tts.provider} />
              <Chip label={cfg.tts.provider} size="small" color="primary" variant="outlined" />
            </ListItem>
          </List>
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}
      </Box>

      {latency && (
        <>
          <Divider />
          <Box sx={{ p: 2 }}>
            <Typography variant="overline" color="text.secondary">Last Turn Latency</Typography>
            <List dense disablePadding>
              <ListItem disableGutters>
                <ListItemText primary="Speech-to-Text" />
                <Chip label={`${latency.sttMs}ms`} size="small"
                  color={latency.sttMs < 800 ? 'success' : latency.sttMs < 1500 ? 'warning' : 'error'} />
              </ListItem>
              <ListItem disableGutters>
                <ListItemText primary="Text-to-Speech" />
                <Chip label={`${latency.ttsMs}ms`} size="small"
                  color={latency.ttsMs < 200 ? 'success' : latency.ttsMs < 500 ? 'warning' : 'error'} />
              </ListItem>
            </List>
          </Box>
        </>
      )}

      <Divider />
      <Box sx={{ p: 2 }}>
        <Typography variant="overline" color="text.secondary">Session</Typography>
        <List dense disablePadding>
          <ListItem disableGutters onClick={() => { onChangeScenario(); onClose(); }}
            sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, borderRadius: 1 }}>
            <ListItemText primary="Change Scenario" secondary="Starts a new session" />
          </ListItem>
        </List>
      </Box>

      <Box sx={{ flexGrow: 1 }} />
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" color="text.disabled">
          Edit .env to change providers. Restart server to apply.
        </Typography>
      </Box>
    </Drawer>
  );
};
