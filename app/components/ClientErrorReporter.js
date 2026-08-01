"use client";

import { useEffect } from "react";
import { reportClientError } from "../../lib/client-error-report";

export default function ClientErrorReporter() {
  useEffect(() => {
    const handleError = (event) => {
      reportClientError({
        type: "window-error",
        error: event.error || new Error(event.message || "Window error")
      });
    };
    const handleRejection = (event) => {
      reportClientError({
        type: "unhandled-rejection",
        error: event.reason || new Error("Unhandled promise rejection")
      });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
