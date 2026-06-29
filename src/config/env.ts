import * as Joi from 'joi';

const schema = Joi.object({
  PORT: Joi.number().default(5020),
  NODE_ENV: Joi.string().default('production'),
  RUNTIME: Joi.string().valid('ec2', 'local').default('local'),
  JWT_SECRET: Joi.string().required(),
  GRACEFUL_SHUTDOWN_MS: Joi.number().default(30_000),
  CORS_ORIGINS: Joi.string().default('*'),
  // Redis
  REDIS_HOST: Joi.string().optional(),
  REDIS_PORT: Joi.number().default(6379),
  INTERNAL_API_SECRET: Joi.string().optional(),
  // Database (Aurora PostgreSQL)
  DB_HOST: Joi.string().optional(),
  DB_PORT: Joi.number().default(5432),
  DB_NAME: Joi.string().default('postgres'),
  DB_USER: Joi.string().default('postgres'),
  DB_PASSWORD: Joi.string().allow('').default(''),
  DB_SSL: Joi.boolean().default(true),
}).unknown(true);

const { value, error } = schema.validate(process.env);
if (error) {
  // eslint-disable-next-line no-console
  console.error('[env] validation failed:', error.message);
  process.exit(1);
}

export const env = {
  PORT: value.PORT as number,
  NODE_ENV: value.NODE_ENV as string,
  RUNTIME: value.RUNTIME as 'ec2' | 'local',
  JWT_SECRET: value.JWT_SECRET as string,
  GRACEFUL_SHUTDOWN_MS: value.GRACEFUL_SHUTDOWN_MS as number,
  CORS_ORIGINS: (value.CORS_ORIGINS as string).split(',').map((s) => s.trim()),
  REDIS_HOST: value.REDIS_HOST as string | undefined,
  REDIS_PORT: value.REDIS_PORT as number,
  INTERNAL_API_SECRET: value.INTERNAL_API_SECRET as string | undefined,
  DB_HOST: value.DB_HOST as string | undefined,
  DB_PORT: value.DB_PORT as number,
  DB_NAME: value.DB_NAME as string,
  DB_USER: value.DB_USER as string,
  DB_PASSWORD: value.DB_PASSWORD as string,
  DB_SSL: value.DB_SSL as boolean,
};
