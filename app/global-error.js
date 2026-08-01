"use client";

import ErrorRecovery from "./components/ErrorRecovery";
import styles from "./error-ui.module.css";

export default function GlobalError({ error, reset }) {
  return (
    <html lang="en">
      <body className={styles.globalBody}>
        <ErrorRecovery error={error} reset={reset} global />
      </body>
    </html>
  );
}
