import { create } from 'zustand';

export interface WizardProfile {
  id: number;
  profile_id: string;
  profile_name: string;
  group_name: string | null;
}

export interface VideoAssignment {
  profileId: number;
  videoId: number;
}

export interface TaskContent {
  profileId: number;
  videoId: number;
  content: string;
  tags: string;
  trans_content: string;
  trans_tags: string;
  cover_path: string | null;
  scheduled_at: string | null;
  timezone: string;
}

interface PublishStore {
  step: number;
  setStep: (s: number) => void;

  // Step 1: Profile selection
  selectedProfiles: WizardProfile[];
  toggleProfile: (p: WizardProfile) => void;
  selectAllInGroup: (profiles: WizardProfile[]) => void;
  clearProfiles: () => void;

  // Step 2: Video assignment
  assignments: VideoAssignment[];
  assignVideo: (profileId: number, videoId: number) => void;
  removeAssignment: (profileId: number, videoId: number) => void;
  autoDistribute: (profileIds: number[], videoIds: number[]) => void;

  // Step 3: Content editing
  taskContents: Record<string, TaskContent>; // key: "profileId-videoId"
  updateTaskContent: (key: string, partial: Partial<TaskContent>) => void;
  applyTagsToAll: (tags: string) => void;
  applyScheduleToAll: (scheduled_at: string, timezone: string) => void;

  // Draft
  toJson: () => string;
  fromJson: (json: string) => void;
  reset: () => void;
}

export const usePublishStore = create<PublishStore>((set, get) => ({
  step: 0,
  setStep: (s) => set({ step: s }),

  // Step 1
  selectedProfiles: [],
  toggleProfile: (p) =>
    set((state) => {
      const exists = state.selectedProfiles.find((sp) => sp.id === p.id);
      if (exists) {
        return { selectedProfiles: state.selectedProfiles.filter((sp) => sp.id !== p.id) };
      }
      return { selectedProfiles: [...state.selectedProfiles, p] };
    }),
  selectAllInGroup: (profiles) =>
    set((state) => {
      const existingIds = new Set(state.selectedProfiles.map((sp) => sp.id));
      const newProfiles = profiles.filter((p) => !existingIds.has(p.id));
      return { selectedProfiles: [...state.selectedProfiles, ...newProfiles] };
    }),
  clearProfiles: () => set({ selectedProfiles: [], assignments: [], taskContents: {} }),

  // Step 2
  assignments: [],
  assignVideo: (profileId, videoId) =>
    set((state) => {
      const exists = state.assignments.find(
        (a) => a.profileId === profileId && a.videoId === videoId,
      );
      if (exists) return state;
      const key = `${profileId}-${videoId}`;
      const newContents = { ...state.taskContents };
      if (!newContents[key]) {
        newContents[key] = {
          profileId,
          videoId,
          content: '',
          tags: '',
          trans_content: '',
          trans_tags: '',
          cover_path: null,
          scheduled_at: null,
          timezone: 'America/Mexico_City',
        };
      }
      return {
        assignments: [...state.assignments, { profileId, videoId }],
        taskContents: newContents,
      };
    }),
  removeAssignment: (profileId, videoId) =>
    set((state) => {
      const key = `${profileId}-${videoId}`;
      const newContents = { ...state.taskContents };
      delete newContents[key];
      return {
        assignments: state.assignments.filter(
          (a) => !(a.profileId === profileId && a.videoId === videoId),
        ),
        taskContents: newContents,
      };
    }),
  autoDistribute: (profileIds, videoIds) =>
    set((state) => {
      const newAssignments: VideoAssignment[] = [];
      const newContents = { ...state.taskContents };
      for (let i = 0; i < profileIds.length; i++) {
        const pid = profileIds[i]!;
        const vid = videoIds[i % videoIds.length]!;
        const exists = state.assignments.find(
          (a) => a.profileId === pid && a.videoId === vid,
        );
        if (!exists) {
          newAssignments.push({ profileId: pid, videoId: vid });
          const key = `${pid}-${vid}`;
          if (!newContents[key]) {
            newContents[key] = {
              profileId: pid,
              videoId: vid,
              content: '',
              tags: '',
              trans_content: '',
              trans_tags: '',
              cover_path: null,
              scheduled_at: null,
              timezone: 'America/Mexico_City',
            };
          }
        }
      }
      return {
        assignments: [...state.assignments, ...newAssignments],
        taskContents: newContents,
      };
    }),

  // Step 3
  taskContents: {},
  updateTaskContent: (key, partial) =>
    set((state) => {
      const existing = state.taskContents[key];
      if (!existing) return state;
      return {
        taskContents: {
          ...state.taskContents,
          [key]: { ...existing, ...partial },
        },
      };
    }),
  applyTagsToAll: (tags) =>
    set((state) => {
      const updated = { ...state.taskContents };
      for (const key of Object.keys(updated)) {
        updated[key] = { ...updated[key]!, tags };
      }
      return { taskContents: updated };
    }),
  applyScheduleToAll: (scheduled_at, timezone) =>
    set((state) => {
      const updated = { ...state.taskContents };
      for (const key of Object.keys(updated)) {
        updated[key] = { ...updated[key]!, scheduled_at, timezone };
      }
      return { taskContents: updated };
    }),

  // Draft serialization
  toJson: () => {
    const { step, selectedProfiles, assignments, taskContents } = get();
    return JSON.stringify({ step, selectedProfiles, assignments, taskContents });
  },
  fromJson: (json) => {
    try {
      const data = JSON.parse(json) as {
        step: number;
        selectedProfiles: WizardProfile[];
        assignments: VideoAssignment[];
        taskContents: Record<string, TaskContent>;
      };
      set({
        step: data.step,
        selectedProfiles: data.selectedProfiles,
        assignments: data.assignments,
        taskContents: data.taskContents,
      });
    } catch {
      // Invalid JSON, ignore
    }
  },
  reset: () =>
    set({
      step: 0,
      selectedProfiles: [],
      assignments: [],
      taskContents: {},
    }),
}));
