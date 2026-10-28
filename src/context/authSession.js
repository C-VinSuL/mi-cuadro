export const getSessionUser = (session) => session?.user ?? null;

export const getSessionIdentity = (session) => session?.user?.id ?? null;

export const shouldResetIdentity = (currentIdentity, session) => currentIdentity !== getSessionIdentity(session);

export const shouldApplySessionHydration = (eventRevisionAtStart, currentEventRevision) =>
  eventRevisionAtStart === 0 && currentEventRevision === eventRevisionAtStart;

export const shouldSendWelcomeEmail = (event, session) => {
  const user = getSessionUser(session);
  return ["SIGNED_IN", "INITIAL_SESSION"].includes(event) && Boolean(user);
};

export const isProfileActive = (profile) => Boolean(profile && profile.activo !== false);

export const shouldClearSessionForInactiveProfile = (profile) => Boolean(profile && profile.activo === false);
