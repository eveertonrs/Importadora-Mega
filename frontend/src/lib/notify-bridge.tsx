// src/lib/notify-bridge.tsx
import { useEffect } from "react";
import { useToast } from "./toast";
import { bindNotifier } from "../services/api";

/**
 * Liga o interceptor do axios (notify) ao nosso toast UI.
 * Renderize <NotifyBridge /> dentro de <ToasterProvider>.
 */
export function NotifyBridge() {
  const { show } = useToast();
  useEffect(() => {
    bindNotifier((type, message) => show({ type, message }));
  }, [show]);
  return null;
}
