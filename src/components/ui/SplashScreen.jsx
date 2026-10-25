import { motion } from "motion/react";

const SplashScreen = () => (
  <main className="grid min-h-dvh place-items-center bg-[#023a2d] px-6 text-center text-white">
    <div className="flex flex-col items-center">
      <motion.img
        src="/flashmonkey-logo.png"
        alt="FlashMonkey"
        className="h-auto w-56 max-w-[70vw] object-contain"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
      <motion.p
        className="mt-5 text-sm font-medium tracking-wide text-emerald-100"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, delay: 0.35 }}
      >
        Ahorra en comunidad y alcanza tus metas.
      </motion.p>
    </div>
  </main>
);

export default SplashScreen;
