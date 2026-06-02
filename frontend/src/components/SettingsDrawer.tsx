import React, { useEffect, useState, useCallback } from 'react';
import {
  Drawer, Box, Typography, Divider, IconButton,
  List, ListItem, ListItemText, Chip, CircularProgress,
  ToggleButtonGroup, ToggleButton, TextField, Select,
  MenuItem, FormControl, InputLabel, Button, Alert,
  InputAdornment,
} from '@mui/material';
import {
  Close as CloseIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';

interface ServerConfig {
  llm: { provider: string; model: string };
  stt: { provider: string; model: string };
  tts: { provider: string };
}

interface LlmSettings {
  provider: 'ollama' | 'lmstudio';
  model: string;
  correctorModel: string;
  ollamaBaseUrl: string;
  ollamaApiKey: string;
  lmstudioBaseUrl: string;
  lmstudioApiKey: string;
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
  translationLang: string;
  onTranslationLangChange: (lang: string) => void;
}

const apiBase = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  open, onClose, latency, onChangeScenario, onTranslationLangChange, translationLang,
}) => {
  const [cfg, setCfg] = useState<ServerConfig | null>(null);
  const [llmSettings, setLlmSettings] = useState<LlmSettings | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<'ok' | 'error' | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  // Local editable copies of llm settings
  const [editProvider, setEditProvider] = useState<'ollama' | 'lmstudio'>('ollama');
  const [editBaseUrl, setEditBaseUrl] = useState('');
  const [editApiKey, setEditApiKey] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editCorrectorModel, setEditCorrectorModel] = useState('');

  const fetchModels = useCallback(async (
    provider: 'ollama' | 'lmstudio',
    baseUrl: string,
    apiKey: string,
  ) => {
    setModelsLoading(true);
    setModelsError(null);
    try {
      const params = new URLSearchParams({ provider, baseUrl });
      if (apiKey) params.set('apiKey', apiKey);
      const res = await fetch(`${apiBase}/api/llm/models?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { models: string[] };
      setModels(data.models);
    } catch (err) {
      setModelsError(String(err));
      setModels([]);
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    fetch(`${apiBase}/api/config`).then(r => r.json()).then(setCfg).catch(() => {});
    fetch(`${apiBase}/api/llm/settings`)
      .then(r => r.json())
      .then((s: LlmSettings) => {
        setLlmSettings(s);
        setEditProvider(s.provider);
        setEditModel(s.model);
        setEditCorrectorModel(s.correctorModel);
        const url = s.provider === 'lmstudio' ? s.lmstudioBaseUrl : s.ollamaBaseUrl;
        const key = s.provider === 'lmstudio' ? s.lmstudioApiKey : s.ollamaApiKey;
        setEditBaseUrl(url);
        setEditApiKey(key);
        fetchModels(s.provider, url, key);
      })
      .catch(() => {});
  }, [open, fetchModels]);

  const handleProviderChange = (_: React.MouseEvent, value: 'ollama' | 'lmstudio' | null) => {
    if (!value || !llmSettings) return;
    setEditProvider(value);
    const url = value === 'lmstudio' ? llmSettings.lmstudioBaseUrl : llmSettings.ollamaBaseUrl;
    const key = value === 'lmstudio' ? llmSettings.lmstudioApiKey : llmSettings.ollamaApiKey;
    setEditBaseUrl(url);
    setEditApiKey(key);
    setEditModel('');
    fetchModels(value, url, key);
  };

  const handleRefreshModels = () => {
    fetchModels(editProvider, editBaseUrl, editApiKey);
  };

  const handleSave = async () => {
    if (!llmSettings) return;
    setSaving(true);
    setSaveResult(null);
    const patch: Partial<LlmSettings> = {
      provider: editProvider,
      model: editModel || llmSettings.model,
      correctorModel: editCorrectorModel || llmSettings.correctorModel,
      ...(editProvider === 'ollama'
        ? { ollamaBaseUrl: editBaseUrl, ollamaApiKey: editApiKey }
        : { lmstudioBaseUrl: editBaseUrl, lmstudioApiKey: editApiKey }),
    };
    try {
      const res = await fetch(`${apiBase}/api/llm/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = await res.json() as LlmSettings;
      setLlmSettings(updated);
      setCfg(prev => prev ? { ...prev, llm: { provider: updated.provider, model: updated.model } } : prev);
      setSaveResult('ok');
      setTimeout(() => setSaveResult(null), 3000);
    } catch {
      setSaveResult('error');
    } finally {
      setSaving(false);
    }
  };

  const defaultUrl = editProvider === 'ollama' ? 'http://localhost:11434' : 'http://localhost:1234';

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: 320, overflowX: 'hidden' } }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SettingsIcon color="primary" />
          <Typography variant="h6" fontWeight={700}>Settings</Typography>
        </Box>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </Box>

      <Divider />

      {/* Providers status */}
      <Box sx={{ p: 2 }}>
        <Typography variant="overline" color="text.secondary">Active Providers</Typography>
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

      <Divider />

      {/* LLM Configuration */}
      <Box sx={{ p: 2 }}>
        <Typography variant="overline" color="text.secondary">LLM Configuration</Typography>

        {!llmSettings ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
            {/* Provider toggle */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Provider
              </Typography>
              <ToggleButtonGroup
                value={editProvider}
                exclusive
                onChange={handleProviderChange}
                size="small"
                fullWidth
              >
                <ToggleButton value="ollama" sx={{ fontSize: '0.75rem' }}>Ollama</ToggleButton>
                <ToggleButton value="lmstudio" sx={{ fontSize: '0.75rem' }}>LM Studio</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {/* Base URL */}
            <TextField
              label="Base URL"
              size="small"
              value={editBaseUrl}
              onChange={e => setEditBaseUrl(e.target.value)}
              placeholder={defaultUrl}
              fullWidth
              onBlur={() => fetchModels(editProvider, editBaseUrl, editApiKey)}
            />

            {/* API Key */}
            <TextField
              label="API Key (optional)"
              size="small"
              value={editApiKey}
              onChange={e => setEditApiKey(e.target.value)}
              type={showApiKey ? 'text' : 'password'}
              fullWidth
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowApiKey(v => !v)}>
                      {showApiKey ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {/* Model */}
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-start' }}>
              <FormControl size="small" fullWidth>
                <InputLabel>Model</InputLabel>
                <Select
                  label="Model"
                  value={models.includes(editModel) ? editModel : ''}
                  onChange={e => setEditModel(e.target.value as string)}
                  disabled={modelsLoading || models.length === 0}
                >
                  {models.map(m => (
                    <MenuItem key={m} value={m} sx={{ fontSize: '0.8rem' }}>{m}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <IconButton
                size="small"
                onClick={handleRefreshModels}
                disabled={modelsLoading}
                sx={{ mt: 0.5 }}
                title="Refresh model list"
              >
                {modelsLoading ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
              </IconButton>
            </Box>

            {modelsError && (
              <Typography variant="caption" color="error" sx={{ fontSize: '0.7rem' }}>
                {editProvider === 'ollama' ? 'Cannot reach Ollama' : 'Cannot reach LM Studio'}: {modelsError}
              </Typography>
            )}

            {/* Corrector Model */}
            <FormControl size="small" fullWidth>
              <InputLabel>Corrector Model</InputLabel>
              <Select
                label="Corrector Model"
                value={models.includes(editCorrectorModel) ? editCorrectorModel : ''}
                onChange={e => setEditCorrectorModel(e.target.value as string)}
                disabled={modelsLoading || models.length === 0}
              >
                {models.map(m => (
                  <MenuItem key={m} value={m} sx={{ fontSize: '0.8rem' }}>{m}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {saveResult === 'ok' && (
              <Alert severity="success" sx={{ py: 0 }}>Settings applied</Alert>
            )}
            {saveResult === 'error' && (
              <Alert severity="error" sx={{ py: 0 }}>Failed to save</Alert>
            )}

            <Button
              variant="contained"
              size="small"
              onClick={handleSave}
              disabled={saving || !editModel}
              fullWidth
            >
              {saving ? <CircularProgress size={16} /> : 'Apply'}
            </Button>
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

      <Divider />
      <Box sx={{ p: 2 }}>
        <Typography variant="overline" color="text.secondary">Study — Quick Translation</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Select text in Study tab to translate it
        </Typography>
        <ToggleButtonGroup
          value={translationLang}
          exclusive
          onChange={(_, v) => { if (v) onTranslationLangChange(v); }}
          size="small"
          fullWidth
        >
          <ToggleButton value="ar" sx={{ fontSize: '0.75rem' }}>عربي</ToggleButton>
          <ToggleButton value="de" sx={{ fontSize: '0.75rem' }}>Deutsch</ToggleButton>
          <ToggleButton value="en" sx={{ fontSize: '0.75rem' }}>English</ToggleButton>
        </ToggleButtonGroup>
      </Box>
    </Drawer>
  );
};
