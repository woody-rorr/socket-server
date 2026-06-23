import * as Joi from 'joi';

const schema = Joi.object({
  PORT: Joi.number().default(5020),
  NODE_ENV: Joi.string().default('production'),
  RUNTIME: Joi.string().valid('ecs', 'ec2', 'local').default('local'),
  JWT_SECRET: Joi.string().required(),
  GRACEFUL_SHUTDOWN_MS: Joi.number().default(30_000),
  CORS_ORIGINS: Joi.string().default('*'),
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
  RUNTIME: value.RUNTIME as 'ecs' | 'ec2' | 'local',
  JWT_SECRET: value.JWT_SECRET as string,
  GRACEFUL_SHUTDOWN_MS: value.GRACEFUL_SHUTDOWN_MS as number,
  CORS_ORIGINS: (value.CORS_ORIGINS as string).split(',').map((s) => s.trim()),
};
