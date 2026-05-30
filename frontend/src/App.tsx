import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ThemeProvider, CssBaseline, Box, Paper, Tab, Tabs,
  Button, Typography,
} from '@mui/material';
import {
  Mic as MicIcon, MenuBook as MenuBookIcon,
  PlayArrow as PlayArrowIcon, Translate as TranslateIcon,
} from '@mui/icons-material';
import theme from './theme.ts';
import { useWebSocket } from './hooks/useWebSocket.ts';
import { useAudioRecorder } from './hooks/useAudioRecorder.ts';
import { useAudioPlayer, unlockAudio } from './hooks/useAudioPlayer.ts';
import { ChatArea, type Message } from './components/ChatArea.tsx';
import { RecordButton } from './components/RecordButton.tsx';
import { ScenarioModal, type ScenarioInfo } from './components/ScenarioModal.tsx';
import { SettingsDrawer } from './components/SettingsDrawer.tsx';
import { StatusBar } from './components/StatusBar.tsx';
import { StudyTab } from './components/StudyTab.tsx';

type AppState = 'idle' | 'recording' | 'processing' | 'speaking';

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';
const WS_BASE  = window.location.hostname === 'localhost'
  ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://localhost:3000`
  : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;

const LS_TRANSLATION_LANG = 'study_translation_lang';

export default function App() {
  const [activeTab, setActiveTab] = useState<'practice' | 'study'>('practice');
  const [messages, setMessages] = useState<Message[]>([]);
  const [appState, setAppState] = useState<AppState>('idle');
  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([]);
  const [selectedScenario, setSelectedScenario] = useState('alltag');
  const [showScenarioModal, setShowScenarioModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [latency, setLatency] = useState<{ sttMs: number; ttsMs: number } | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [translationLang, setTranslationLang] = useState<string>(
    () => localStorage.getItem(LS_TRANSLATION_LANG) ?? 'ar',
  );
  const activeSessionRef = useRef(false);

  const handleTranslationLangChange = useCallback((lang: string) => {
    setTranslationLang(lang);
    localStorage.setItem(LS_TRANSLATION_LANG, lang);
  }, []);

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

  // ── Load scenarios (no auto-open) ─────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/api/scenarios`)
      .then(r => r.json())
      .then((data: { scenarios: ScenarioInfo[] }) => setScenarios(data.scenarios))
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
    unlockAudio();
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
    interrupt();
    const reader = new FileReader();
    reader.onloadend = () => {
      const b64 = (reader.result as string).split(',')[1];
      send({ type: 'audio', data: b64 });
    };
    reader.readAsDataURL(blob);
  }, [send, interrupt]);

  const recorderEnabled = activeTab === 'practice' && wsStatus === 'connected' && appState !== 'processing';

  const { isRecording, audioLevel, startRecording, stopRecording } = useAudioRecorder(
    handleAudioReady,
    recorderEnabled,
  );

  useEffect(() => {
    if (isRecording) { interrupt(); setAppState('recording'); }
  }, [isRecording, interrupt]);

  const selectedScenarioInfo = scenarios.find(s => s.id === selectedScenario);
  const practiceConnected = wsStatus === 'connected';

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
        <StatusBar
          wsStatus={wsStatus}
          appState={appState}
          scenarioTitle={activeTab === 'practice' && practiceConnected ? (selectedScenarioInfo?.title ?? '') : ''}
          onReconnect={handleReconnect}
          onSettings={() => setShowSettings(true)}
        />

        {/* Tab bar */}
        <Box sx={{ bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v as 'practice' | 'study')}
            variant="fullWidth"
            sx={{ minHeight: 44 }}
          >
            <Tab
              value="practice"
              label="Practice"
              icon={<MicIcon sx={{ fontSize: 18 }} />}
              iconPosition="start"
              sx={{ minHeight: 44, textTransform: 'none', fontWeight: 600, fontSize: '0.9rem' }}
            />
            <Tab
              value="study"
              label="Study"
              icon={<MenuBookIcon sx={{ fontSize: 18 }} />}
              iconPosition="start"
              sx={{ minHeight: 44, textTransform: 'none', fontWeight: 600, fontSize: '0.9rem' }}
            />
          </Tabs>
        </Box>

        <Paper sx={{
          flexGrow: 1, mx: { xs: 0, sm: 2 }, my: { xs: 0, sm: 1.5 },
          borderRadius: { xs: 0, sm: 3 },
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', minHeight: 0,
        }}>

          {/* ── Practice tab ── */}
          {activeTab === 'practice' && (
            practiceConnected ? (
              <>
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
                    disabled={appState === 'processing'}
                  />
                </Box>
              </>
            ) : (
              /* Welcome / start screen */
              <Box sx={{
                flexGrow: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 2.5, p: 4,
              }}>
                <TranslateIcon sx={{ fontSize: 72, color: 'primary.light', opacity: 0.6 }} />
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    Ready to practice German?
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Choose a scenario and start speaking with Lina
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<PlayArrowIcon />}
                  onClick={() => { unlockAudio(); setShowScenarioModal(true); }}
                  sx={{ borderRadius: 3, px: 4 }}
                >
                  Start Practice
                </Button>
              </Box>
            )
          )}

          {/* ── Study tab ── */}
          {activeTab === 'study' && (
            <StudyTab translationLang={translationLang} />
          )}
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
          translationLang={translationLang}
          onTranslationLangChange={handleTranslationLangChange}
        />
      </Box>
    </ThemeProvider>
  );
}
