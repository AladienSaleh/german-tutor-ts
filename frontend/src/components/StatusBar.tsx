import React from 'react';
import { AppBar, Toolbar, Box, Typography, IconButton, Tooltip } from '@mui/material';
import {
  Translate as TranslateIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import type { WsStatus } from '../hooks/useWebSocket.ts';

type AppState = 'idle' | 'recording' | 'processing' | 'speaking';

interface StatusBarProps {
  wsStatus: WsStatus;
  appState: AppState;
  scenarioTitle: string;
  onReconnect: () => void;
  onSettings: () => void;
}

const STATE_COLORS: Record<AppState, string> = {
  idle:       '#9e9e9e',
  recording:  '#d32f2f',
  processing: '#f57c00',
  speaking:   '#2e7d32',
};

const STATE_LABELS: Record<AppState, string> = {
  idle:       'Ready',
  recording:  'Recording',
  processing: 'Processing',
  speaking:   'Speaking',
};

export const StatusBar: React.FC<StatusBarProps> = ({
  wsStatus, appState, scenarioTitle, onReconnect, onSettings,
}) => {
  const connected = wsStatus === 'connected';
  const connecting = wsStatus === 'connecting';

  return (
    <AppBar position="static" sx={{ bgcolor: '#2e7d32', flexShrink: 0 }}>
      <Toolbar sx={{ minHeight: '52px !important', gap: 1 }}>
        <TranslateIcon sx={{ mr: 0.5 }} />
        <Typography variant="subtitle1" fontWeight={700} sx={{ flexGrow: 1 }}>
          Lina
          {scenarioTitle && (
            <Typography component="span" variant="caption" sx={{ ml: 1, opacity: 0.8 }}>
              · {scenarioTitle}
            </Typography>
          )}
        </Typography>

        {/* Connection dot + state */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{
            width: 9, height: 9, borderRadius: '50%',
            bgcolor: connected ? STATE_COLORS[appState] : connecting ? '#ff9800' : '#f44336',
            boxShadow: connected && appState !== 'idle'
              ? `0 0 6px ${STATE_COLORS[appState]}`
              : 'none',
            transition: 'all 0.3s',
          }} />
          <Typography variant="caption" sx={{ opacity: 0.9, minWidth: 72 }}>
            {!connected
              ? (connecting ? 'Connecting…' : 'Disconnected')
              : STATE_LABELS[appState]}
          </Typography>
        </Box>

        {!connected && !connecting && (
          <Tooltip title="Reconnect">
            <IconButton color="inherit" size="small" onClick={onReconnect}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        <Tooltip title="Settings">
          <IconButton color="inherit" size="small" onClick={onSettings}>
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Toolbar>
    </AppBar>
  );
};
