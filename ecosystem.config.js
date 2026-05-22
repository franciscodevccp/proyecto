module.exports = {
  apps: [{
    name: 'comunas-norm',
    script: 'pnpm',
    args: 'start',
    cwd: __dirname,
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
    },
  }],
};
