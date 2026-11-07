"use client";
import { useEffect } from "react";
import { isNative } from "@/lib/native";

/** Registers the offline cache in production builds only. */
export function ServiceWorker() {
  useEffect(() => {
    if (isNative()) return; // files are local; WKWebView has no service workers on capacitor://
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
