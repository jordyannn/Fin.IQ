module.exports = {
  apps: [
    {
      name: "fin-iq",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: "./",
      instances: "max",
      exec_mode: "cluster",
      env: {
        PORT: 3000,
        NODE_ENV: "production",
      },
    },
  ],
};
