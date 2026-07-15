module.exports = {
  apps: [
    {
      name: 'agap-portal-staging-backend',
      script: 'apps/api/src/server.js',
      cwd: '/mnt/agap-portal-staging',
      env: {
        NODE_ENV: 'production',
        PORT: 5055,
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '1G',
      error_file: '/mnt/agap-portal-staging/apps/api/logs/error.log',
      out_file: '/mnt/agap-portal-staging/apps/api/logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    }
  ]
};
