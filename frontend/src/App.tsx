import { useState, useEffect, useCallback, useRef } from 'react';
import { ThemeProvider, CssBaseline, Box, Paper } from '@mui/material';
import theme from './theme.ts';
import { useWebSocket } from './hooks/useWebSocket.ts';
import { useAudioRecorder } from './hooks/useAudioRecorder.ts';
import { useAudioPlayer, unlockAudio } from './hooks/useAudioPlayer.ts';
import { ChatArea, type Message } from './components/ChatArea.tsx';
import { RecordButton } from './components/RecordButton.tsx';
import { ScenarioModal, type ScenarioInfo } from './components/ScenarioModal.tsx';
import { SettingsDrawer } from './components/SettingsDrawer.tsx';
import { StatusBar } from './components/StatusBar.tsx';

type AppState = 'idle' | 'recording' | 'processing' | 'speaking';

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';
const WS_BASE  = window.location.hostname === 'localhost'
  ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://localhost:3000`
  : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [appState, setAppState] = useState<AppState>('idle');
  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([]);
  const [selectedScenario, setSelectedScenario] = useState('alltag');
  const [showScenarioModal, setShowScenarioModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [latency, setLatency] = useState<{ sttMs: number; ttsMs: number } | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const activeSessionRef = useRef(false);

  // ── Audio player ─────────────────────────────────────────────────────────────
  const { isPlaying, enqueue, interrupt } = useAudioPlayer();

  useEffect(() => {
    setAppState(prev => {
      if (prev === 'processing' || prev === 'recording') return prev;
      return isPlaying ? 'speaking' : 'idle';
    });
  }, [isPlaying]);

  // ── WebSocket ─────────────────────────────────────────────────────────────────
  const handleMessage = useCallback((msg: { type: string; text?: string; lang?: string; data?: string; timing?: { sttMs: number; ttsMs: number } }) => {
    switch (msg.type) {
      case 'transcript':
        setMessages(prev => [...prev, { type: 'user', text: msg.text!, lang: msg.lang }]);
        setIsTyping(true);
        break;
      case 'reply_text':
        setIsTyping(false);
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.type === 'lina' && last.streaming) {
            return [...prev.slice(0, -1), { ...last, text: last.text + ' ' + msg.text!, streaming: true }];
          }
          return [...prev, { type: 'lina', text: msg.text!, streaming: true }];
        });
        break;
      case 'audio':
        enqueue(msg.data!);
        break;
      case 'correction':
        setMessages(prev => [...prev, { type: 'correction', text: msg.text! }]);
        break;
      case 'turn_end':
        setIsTyping(false);
        setMessages(prev => prev.map(m => m.streaming ? { ...m, streaming: false } : m));
        setAppState('idle');
        break;
      case 'timing':
        if (msg.timing) setLatency(msg.timing);
        break;
      case 'error':
        setMessages(prev => [...prev, { type: 'lina', text: `⚠ ${msg.text}` }]);
        setAppState('idle');
        break;
    }
  }, [enqueue]);

  const { status: wsStatus, connect, send } = useWebSocket({
    onMessage: handleMessage,
    onStatusChange: (s) => {
      if (s === 'disconnected') {
        setAppState('idle');
        setIsTyping(false);
        activeSessionRef.current = false;
      }
    },
  });

  // ── Load scenarios ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/api/scenarios`)
      .then(r => r.json())
      .then((data: { scenarios: ScenarioInfo[] }) => {
        setScenarios(data.scenarios);
        if (data.scenarios.length > 0) {
          setShowScenarioModal(true);
        }
      })
      .catch(() => {});
  }, []);

  // ── Session connect ───────────────────────────────────────────────────────────
  const startSession = useCallback((scenarioId: string) => {
    setMessages([]);
    setLatency(null);
    setIsTyping(false);
    activeSessionRef.current = true;
    connect(`${WS_BASE}/ws/chat/${scenarioId}`);
  }, [connect]);

  const handleScenarioSelect = useCallback((id: string) => {
    unlockAudio(); // pre-unlock AudioContext from this click gesture
    setSelectedScenario(id);
    setShowScenarioModal(false);
    startSession(id);
  }, [startSession]);

  const handleReconnect = useCallback(() => {
    unlockAudio();
    startSession(selectedScenario);
  }, [startSession, selectedScenario]);

  // ── Audio recording ───────────────────────────────────────────────────────────
  const handleAudioReady = useCallback((blob: Blob) => {
    setAppState('processing');
    interrupt(); // stop Lina speaking when user talks
    const reader = new FileReader();
    reader.onloadend = () => {
      const b64 = (reader.result as string).split(',')[1];
      send({ type: 'audio', data: b64 });
    };
    reader.readAsDataURL(blob);
  }, [send, interrupt]);

  const recorderEnabled = wsStatus === 'connected' && appState !== 'processing';

  const { isRecording, audioLevel, startRecording, stopRecording } = useAudioRecorder(
    handleAudioReady,
    recorderEnabled,
  );

  useEffect(() => {
    if (isRecording) { interrupt(); setAppState('recording'); }
  }, [isRecording, interrupt]);

  const selectedScenarioInfo = scenarios.find(s => s.id === selectedScenario);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
        <StatusBar
          wsStatus={wsStatus}
          appState={appState}
          scenarioTitle={selectedScenarioInfo?.title ?? ''}
          onReconnect={handleReconnect}
          onSettings={() => setShowSettings(true)}
        />

        <Paper sx={{
          flexGrow: 1, mx: { xs: 0, sm: 2 }, my: { xs: 0, sm: 1.5 },
          borderRadius: { xs: 0, sm: 3 },
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', minHeight: 0,
        }}>
          <ChatArea messages={messages} isTyping={isTyping} />

          <Box sx={{
            borderTop: '1px solid', borderColor: 'divider',
            display: 'flex', justifyContent: 'center',
            py: 2, px: 2,
          }}>
            <RecordButton
              appState={appState}
              audioLevel={audioLevel}
              onPress={() => { unlockAudio(); startRecording(); }}
              onRelease={stopRecording}
              disabled={wsStatus !== 'connected' || appState === 'processing'}
            />
          </Box>
        </Paper>

        <ScenarioModal
          open={showScenarioModal}
          scenarios={scenarios}
          selected={selectedScenario}
          onSelect={handleScenarioSelect}
        />

        <SettingsDrawer
          open={showSettings}
          onClose={() => setShowSettings(false)}
          latency={latency}
          onChangeScenario={() => setShowScenarioModal(true)}
        />
      </Box>
    </ThemeProvider>
  );
}
