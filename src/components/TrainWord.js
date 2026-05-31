import styles from "./TrainWord.module.css";

export default function TrainWord({ className = "" }) {
  return (
    <span className={`${styles.trainWord} ${className}`}>
      tr<span className={styles.ai}>AI</span>n
    </span>
  );
}
