module.exports = {
  apps: [
    {
      name: 'koral-api',
      script: 'server.js',
      instances: 'max',       // one worker per CPU core
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      // Logging
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Restart policy
      max_memory_restart: '500M',
      kill_timeout: 10000,     // ms — matches server.js graceful shutdown timeout
      wait_ready: false,
      listen_timeout: 8000,
    },
  ],
};
