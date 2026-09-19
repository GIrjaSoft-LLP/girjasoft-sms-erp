const path = require("path");
const os = require("os");

/** @type {import('pm2').StartOptions} */
module.exports = {
  apps: [
    {
      name: "gs-sms-erp",
      script: "npm",
      args: "start",
      cwd: path.join(os.homedir(), "girjasoft-sms-erp"),
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "450M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "0.0.0.0",
      },
    },
  ],
};
