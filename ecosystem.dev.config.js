module.exports = {
  apps: [
    {
      name: 'aigis',
      script: './index.js',
      watch: true,
      env: {
        DEV: 1,
        NODE_ENV: 'development',
        NODE_EXTRA_CA_CERTS: "/Users/matthew/Development/discord-aigis/mangaplus.pem"
      },
      ignore_watch: [
        './node_modules',
        '.gitignore',
        '**/temp',
        '.git',
        './images',
      ],
      log_type: 'raw',
    }
  ]
}