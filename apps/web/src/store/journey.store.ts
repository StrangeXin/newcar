'use client';

import { create } from 'zustand';
import { Journey } from '@/types/api';

interface JourneyState {
  journey: Journey | null;
  setJourney: (journey: Journey | null) => void;
}

export const useJourneyStore = create<JourneyState>((set) => ({
  journey: null,
  setJourney: (journey) => set({ journey }),
}));
