import TrainWord from "./TrainWord";
import styles from "./VideoSection.module.css";

const VIDEO_POSTER_URL = "/video/demo_main_poster.jpg";
const VIDEO_SRC_URL = "/video/demo_main.mp4";

export default function VideoSection({
  label = "trAIn REDUCES ONBOARDING TIME",
  className = "",
  background = "charcoal",
}) {
  // Helper to render label with branded TrainWord
  const renderLabel = (text) => {
    if (typeof text !== 'string') return text;
    const parts = text.split("trAIn");
    if (parts.length === 1) return text;
    
    return parts.reduce((acc, part, i) => {
      if (i === 0) return [part];
      return [...acc, <TrainWord key={i} />, part];
    }, []);
  };

  return (
    <section
      className={`${styles.section} ${background === "obsidian" ? styles.sectionObsidian : ""} ${className}`.trim()}
      aria-label="Video Demonstration"
    >
      <div className="container">
        <span className={styles.label}>
          {renderLabel(label)}
        </span>
        
        <div className={styles.videoContainer}>
          <video
            className={styles.videoPlayer}
            controls
            preload="none"
            poster={VIDEO_POSTER_URL}
          >
            <source src={VIDEO_SRC_URL} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>
      </div>
    </section>
  );
}
