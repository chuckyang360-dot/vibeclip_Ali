export interface SegmentItem {
  id: number;
  name: string;
  duration: string;
  goal: string;
  characters: string[];
  scene: string;
  placement: string;
  color: string;
  isNew?: boolean;
  shots: {
    id: number;
    desc: string;
    action: string;
    dialogue: string;
    emotion: string;
    duration: string;
  }[];
}

export interface RenderProgress {
  /** phase identifier: "analyzing" | "keyframes" | "shot_N" | "grading" | "audio" | "encoding" */
  phase: string;
  phaseLabel: string;
  percent: number;
  /** which shot is currently rendering (1-indexed), 0 = not in shot rendering phase */
  currentShot: number;
  totalShots: number;
  totalFrames: number;
}

export type VideoStatus = "idle" | "generating" | "done";
export type VideoStatusMap = Record<number, VideoStatus>;
export type RenderProgressMap = Record<number, RenderProgress>;
