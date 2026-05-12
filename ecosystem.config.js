module.exports = {
  apps: [{
    name: 'comunas-norm',
    script: 'pnpm',
    args: 'start',
    cwd: '/var/www/comunas-norm',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
    },
  }],
};
