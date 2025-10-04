module.exports = {
  apps: [
    {
      name: 'aigis',
      script: './index.js',
      watch: false,
      env: {
        DEV: 0,
        NODE_ENV: "production",
        NODE_EXTRA_CA_CERTS: "/app/main.pem",
        TZ: "America/New_York"
      },
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      log_type: "json"
    }
  ]
}