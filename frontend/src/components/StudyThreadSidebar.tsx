import React, { useState } from 'react';
import {
  Box, Typography, IconButton, Tooltip, List, ListItemButton,
  ListItemText, Divider, Button,
} from '@mui/material';
import {
  Add as AddIcon,
  DeleteOutline as DeleteIcon,
  ChatBubbleOutline as ThreadIcon,
  ChevronLeft as CollapseIcon,
  ChevronRight as ExpandIcon,
} from '@mui/icons-material';
import type { ThreadMeta } from '../types/study.ts';

interface Props {
  threads: ThreadMeta[];
  currentId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export const StudyThreadSidebar: React.FC<Props> = ({
  threads, currentId, onSelect, onNew, onDelete,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (collapsed) {
    return (
      <Box sx={{
        width: 36, flexShrink: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', pt: 1, gap: 1,
        borderRight: '1px solid', borderColor: 'divider', bgcolor: 'grey.50',
      }}>
        <Tooltip title="Expand threads" placement="right">
          <IconButton size="small" onClick={() => setCollapsed(false)}>
            <ExpandIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="New thread" placement="right">
          <IconButton size="small" color="primary" onClick={onNew}>
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {threads.map(t => (
          <Tooltip key={t.id} title={t.title} placement="right">
            <IconButton
              size="small"
              onClick={() => onSelect(t.id)}
              sx={{ color: t.id === currentId ? 'primary.main' : 'text.disabled' }}
            >
              <ThreadIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        ))}
      </Box>
    );
  }

  return (
    <Box sx={{
      width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column',
      borderRight: '1px solid', borderColor: 'divider', bgcolor: 'grey.50',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', px: 1.5, py: 1, gap: 0.5 }}>
        <Typography variant="overline" sx={{ flexGrow: 1, color: 'text.secondary', fontSize: '0.7rem', letterSpacing: 1 }}>
          Conversations
        </Typography>
        <Tooltip title="Collapse">
          <IconButton size="small" onClick={() => setCollapsed(true)} sx={{ opacity: 0.5 }}>
            <CollapseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ px: 1, pb: 1 }}>
        <Button
          fullWidth
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={onNew}
          sx={{ borderRadius: 2, textTransform: 'none', fontSize: '0.82rem' }}
        >
          New thread
        </Button>
      </Box>

      <Divider />

      {/* Thread list */}
      <List dense disablePadding sx={{ flexGrow: 1, overflowY: 'auto' }}>
        {threads.map(t => (
          <ListItemButton
            key={t.id}
            selected={t.id === currentId}
            onClick={() => onSelect(t.id)}
            onMouseEnter={() => setHoveredId(t.id)}
            onMouseLeave={() => setHoveredId(null)}
            sx={{
              py: 0.75, px: 1.5, alignItems: 'flex-start',
              '&.Mui-selected': { bgcolor: 'rgba(46,125,50,0.08)' },
              '&.Mui-selected:hover': { bgcolor: 'rgba(46,125,50,0.13)' },
            }}
          >
            <ListItemText
              primary={
                <Typography variant="body2" noWrap fontWeight={t.id === currentId ? 600 : 400}
                  sx={{ fontSize: '0.83rem', color: t.id === currentId ? 'primary.dark' : 'text.primary' }}>
                  {t.title}
                </Typography>
              }
              secondary={
                <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.7rem' }}>
                    {formatDate(t.updatedAt)}
                  </Typography>
                  {t.preview && (
                    <Typography variant="caption" noWrap sx={{ color: 'text.disabled', fontSize: '0.7rem', flexGrow: 1 }}>
                      · {t.preview}
                    </Typography>
                  )}
                </Box>
              }
            />
            {hoveredId === t.id && (
              <Tooltip title="Delete">
                <IconButton
                  size="small"
                  onClick={e => { e.stopPropagation(); onDelete(t.id); }}
                  sx={{ ml: 0.5, mt: 0.25, opacity: 0.5, '&:hover': { opacity: 1, color: 'error.main' } }}
                >
                  <DeleteIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
            )}
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
};
