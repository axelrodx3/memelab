import { ArrowLeft, SearchX } from "lucide-react";
import Link from "next/link";
import styles from "./error-ui.module.css";

export default function NotFound() {
  return (
    <main className={styles.page}>
      <div className={styles.ambientOne} aria-hidden="true" />
      <div className={styles.ambientTwo} aria-hidden="true" />
      <section className={styles.card}>
        <div className={styles.iconWrap}><SearchX size={25} strokeWidth={1.8} /></div>
        <p className={styles.eyebrow}>404 · PAGE NOT FOUND</p>
        <h1>This page drifted out of the lab.</h1>
        <p className={styles.copy}>The link may be old, or the page may have moved. Let’s get you back to the good stuff.</p>
        <div className={styles.actions}>
          <Link className={styles.primaryAction} href="/templates">Browse templates</Link>
          <Link className={styles.secondaryAction} href="/"><ArrowLeft size={15} /> Return home</Link>
        </div>
      </section>
    </main>
  );
}
