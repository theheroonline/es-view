import { isWails } from "../../wailsapi";
import { esHttpTransport } from "../http/esHttpTransport";
import { esDesktopTransport } from "../wails/esDesktopTransport";

export function selectEsTransport() {
  return isWails() ? esDesktopTransport : esHttpTransport;
}