module.exports = {
  apps: [
    {
      name: 'aigis',
      script: './index.js',
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    }
  ]
}