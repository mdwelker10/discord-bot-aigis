module.exports = {
  apps: [
    {
      name: 'aigis',
      script: './index.js',
      watch: false,
      env: {
        DEV: 0,
        NODE_ENV: "production",
        NODE_EXTRA_CA_CERTS: "/home/ec2-user/aigis/main.pem"
      },
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      log_type: "json"
    }
  ]
}