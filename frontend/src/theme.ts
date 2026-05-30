import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary:   { main: '#2e7d32', light: '#4caf50', dark: '#1b5e20' },
    secondary: { main: '#d32f2f' },
    background: { default: '#f1f5f1', paper: '#ffffff' },
  },
  typography: {
    fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
    body1: { fontSize: '0.95rem', lineHeight: 1.55 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiPaper:    { defaultProps: { elevation: 0 }, styleOverrides: { root: { border: '1px solid #e8f5e9' } } },
    MuiFab:      { styleOverrides: { root: { boxShadow: '0 4px 20px rgba(0,0,0,0.15)' } } },
    MuiChip:     { styleOverrides: { root: { fontWeight: 600 } } },
    MuiAppBar:   { styleOverrides: { root: { boxShadow: '0 2px 8px rgba(0,0,0,0.12)' } } },
  },
});

export default theme;
