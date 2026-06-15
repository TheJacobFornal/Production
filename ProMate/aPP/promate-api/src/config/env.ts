export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  db: {
    host: (process.env.DB_HOST ?? '10.1.69.13:50461').split(':')[0],
    port: parseInt((process.env.DB_HOST ?? '10.1.69.13:50461').split(':')[1] ?? '50461'),
    name: process.env.DB_NAME ?? 'worksheets_prod',
    user: process.env.DB_USER ?? 'ws',
    password: process.env.DB_PASSWORD ?? '',
  },
}
