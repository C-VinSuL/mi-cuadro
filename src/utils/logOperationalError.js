export const logOperationalError = (context, error) => {
  console.error(context, {
    name: error?.name || "Error",
    code: error?.code || null,
    status: error?.status || null,
  });
};
