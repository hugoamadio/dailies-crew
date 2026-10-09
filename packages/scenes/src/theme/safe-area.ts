export const FRAME_WIDTH = 1080;
export const FRAME_HEIGHT = 1920;

/** Pixels TikTok, Reels and Shorts cover with their buttons, captions and progress bar */
export const SAFE_AREA = { top: 220, right: 150, bottom: 460, left: 72 } as const;

/** Band at the bottom of the safe area that belongs to the captions */
export const CAPTION_BAND = 260;

/** Where pieces draw: the safe area minus the caption band */
export const CONTENT_AREA = {
  top: SAFE_AREA.top,
  right: SAFE_AREA.right,
  bottom: SAFE_AREA.bottom + CAPTION_BAND,
  left: SAFE_AREA.left,
} as const;

export const SAFE_WIDTH = FRAME_WIDTH - SAFE_AREA.left - SAFE_AREA.right;
export const SAFE_HEIGHT = FRAME_HEIGHT - SAFE_AREA.top - SAFE_AREA.bottom;
export const CONTENT_WIDTH = FRAME_WIDTH - CONTENT_AREA.left - CONTENT_AREA.right;
export const CONTENT_HEIGHT = FRAME_HEIGHT - CONTENT_AREA.top - CONTENT_AREA.bottom;
