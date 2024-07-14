module.exports = {
  apps: [
    {
      name: 'aigis',
      script: './index.js',
      watch: false,
      env: {
        DEV: 0,
        NODE_ENV: "production",
      },
    }
  ]
}