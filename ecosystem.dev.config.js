module.exports = {
  apps: [
    {
      name: 'aigis',
      script: './index.js',
      watch: true,
      env: {
        DEV: 1,
        NODE_ENV: 'development',
      },
      ignore_watch: [
        'node_modules',
        '.gitignore',
        '**/temp',
        '.git'
      ]
    }
  ]
}