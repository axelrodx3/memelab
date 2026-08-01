"use client";

import { useEffect } from "react";
import { ArrowLeft, FlaskConical, RefreshCw } from "lucide-react";
import { reportClientError } from "../../lib/client-error-report";
import styles from "../error-ui.module.css";

export default function ErrorRecovery({ error, reset, global = false }) {
  useEffect(() => {
    reportClientError({
      type: global ? "global-error-boundary" : "route-error-boundary",
      error,
      digest: error?.digest
    });
  }, [error, global]);

  const retry = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
      return;
    }
    reset?.();
  };

  return (
    <main className={`${styles.page} ${global ? styles.globalPage : ""}`}>
      <div className={styles.ambientOne} aria-hidden="true" />
      <div className={styles.ambientTwo} aria-hidden="true" />
      <section className={styles.card} role="alert" aria-live="assertive">
        <div className={styles.iconWrap}><FlaskConical size={25} strokeWidth={1.8} /></div>
        <p className={styles.eyebrow}>MEMELAB SYSTEM NOTICE</p>
        <h1>A small hiccup in the lab.</h1>
        <p className={styles.copy}>
          This page ran into a temporary issue. Your account and work are safe. Try again, or head back to a fresh start.
        </p>
        <div className={styles.actions}>
          <button className={styles.primaryAction} type="button" onClick={retry}>
            <RefreshCw size={15} /> Try again
          </button>
          <a className={styles.secondaryAction} href="/">
            <ArrowLeft size={15} /> Return home
          </a>
        </div>
        <p className={styles.note}>If this keeps happening, refresh once and try again in a moment.</p>
      </section>
    </main>
  );
}
