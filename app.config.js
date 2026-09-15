module.exports = ({ config }) => {
  return {
    ...config,
    extra: {
      ...config.extra,
      apiUrl: process.env.EXPO_PUBLIC_API_URL || "https://edunex-backend-rmvx.onrender.com/api/v1",
    },
  };
};
