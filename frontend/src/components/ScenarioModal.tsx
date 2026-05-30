import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, Grid2 as Grid,
  Card, CardActionArea, CardContent, Typography, Box, Chip,
} from '@mui/material';
import { School as SchoolIcon } from '@mui/icons-material';

export interface ScenarioInfo {
  id: string;
  title: string;
  description: string;
}

interface ScenarioModalProps {
  open: boolean;
  scenarios: ScenarioInfo[];
  selected: string;
  onSelect: (id: string) => void;
}

export const ScenarioModal: React.FC<ScenarioModalProps> = ({ open, scenarios, selected, onSelect }) => {
  return (
    <Dialog open={open} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SchoolIcon color="primary" />
          <Typography variant="h6" fontWeight={700}>Choose a Lesson</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Lina will guide you through the topic step by step.
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pt: 0 }}>
        <Grid container spacing={2}>
          {scenarios.map(s => (
            <Grid key={s.id} size={{ xs: 12, sm: 6 }}>
              <Card
                sx={{
                  cursor: 'pointer', height: '100%',
                  border: s.id === selected ? '2px solid' : '1px solid',
                  borderColor: s.id === selected ? 'primary.main' : 'divider',
                  bgcolor: s.id === selected ? 'primary.50' : 'background.paper',
                  transition: 'all 0.15s',
                  '&:hover': { borderColor: 'primary.main', transform: 'translateY(-2px)', boxShadow: 3 },
                }}
                elevation={0}
              >
                <CardActionArea onClick={() => onSelect(s.id)} sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                      {s.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {s.description}
                    </Typography>
                    {s.id === selected && (
                      <Chip label="Selected" color="primary" size="small" />
                    )}
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </DialogContent>
    </Dialog>
  );
};
