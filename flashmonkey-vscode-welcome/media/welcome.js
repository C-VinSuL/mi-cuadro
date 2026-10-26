const video = document.querySelector("#welcome-video");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const syncPlayback = () => {
  if (reducedMotion.matches) {
    video.pause();
    return;
  }

  video.play().catch((error) => {
    console.error("No se pudo reproducir el video de bienvenida:", error);
  });
};

syncPlayback();
reducedMotion.addEventListener("change", syncPlayback);
