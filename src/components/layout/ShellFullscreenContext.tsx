import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';

type ShellFullscreenContextValue = {
  shellRef: RefObject<HTMLDivElement | null>;
  isFullscreen: boolean;
  enterFullscreen: () => Promise<boolean>;
  exitFullscreen: () => Promise<void>;
  toggleFullscreen: () => Promise<void>;
};

const ShellFullscreenContext =
  createContext<ShellFullscreenContextValue | null>(null);

export function ShellFullscreenProvider({ children }: { children: ReactNode }) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const sync = () => {
      setIsFullscreen(document.fullscreenElement === shellRef.current);
    };
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const enterFullscreen = useCallback(async () => {
    const shell = shellRef.current;
    if (!shell) return false;
    try {
      if (document.fullscreenElement === shell) return true;
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      await shell.requestFullscreen();
      return true;
    } catch {
      return false;
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) return;
    try {
      await document.exitFullscreen();
    } catch {
      // ignore
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement === shellRef.current) {
      await exitFullscreen();
      return;
    }
    await enterFullscreen();
  }, [enterFullscreen, exitFullscreen]);

  const value = useMemo(
    () => ({
      shellRef,
      isFullscreen,
      enterFullscreen,
      exitFullscreen,
      toggleFullscreen,
    }),
    [isFullscreen, enterFullscreen, exitFullscreen, toggleFullscreen],
  );

  return (
    <ShellFullscreenContext.Provider value={value}>
      {children}
    </ShellFullscreenContext.Provider>
  );
}

export function useShellFullscreen(): ShellFullscreenContextValue {
  const value = useContext(ShellFullscreenContext);
  if (!value) {
    throw new Error(
      'useShellFullscreen must be used within ShellFullscreenProvider',
    );
  }
  return value;
}

/** 全画面時にプロット高さを伸ばす（グラフ系画面共通） */
export function useFullscreenPlotHeight(
  baseHeight: number,
  fullscreenHeight: number = Math.round(baseHeight * 1.35),
): number {
  const { isFullscreen } = useShellFullscreen();
  return isFullscreen ? fullscreenHeight : baseHeight;
}
