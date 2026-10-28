const STARTUP_SPLASH_STORAGE_KEY = "flashmonkey-startup-splash-shown";

export const hasSeenStartupSplash = (storage) =>
  Boolean(storage.getItem(STARTUP_SPLASH_STORAGE_KEY));

export const markStartupSplashShown = (storage) => {
  storage.setItem(STARTUP_SPLASH_STORAGE_KEY, "true");
};
