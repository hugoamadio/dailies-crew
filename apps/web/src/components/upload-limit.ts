/** The server actions' body limit (next.config.ts): bigger forms never reach the server */
export const UPLOAD_LIMIT_BYTES = 25 * 1024 * 1024;

/** Whether the files picked in a form add up to more than the limit (checked before sending) */
export function filesTooBig(form: HTMLFormElement): boolean {
  let total = 0;
  for (const input of form.querySelectorAll<HTMLInputElement>('input[type="file"]')) {
    for (const file of input.files ?? []) total += file.size;
  }
  return total > UPLOAD_LIMIT_BYTES;
}
