"use client";

import ErrorRecovery from "./components/ErrorRecovery";

export default function Error({ error, reset }) {
  return <ErrorRecovery error={error} reset={reset} />;
}
