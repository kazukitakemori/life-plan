export type FormControlWidth = 'short' | 'medium' | 'long' | 'full';

export function getFormControlWidthClassName(
  width?: FormControlWidth,
): string {
  return width ? `ui-control-width--${width}` : '';
}
