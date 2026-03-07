import { refs } from "./refs";

export function setStatus(message: string, timeout = 1800): void {
  refs.status.textContent = message;
  if (timeout > 0) {
    setTimeout(() => {
      if (refs.status.textContent === message) {
        refs.status.textContent = "";
      }
    }, timeout);
  }
}
