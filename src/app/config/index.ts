import dotenv from "dotenv";
import path from "path";
import type {StringValue} from 'ms'

dotenv.config({ path: path.join(process.cwd(), ".env") });

export default {
  env: process.env.NODE_ENV,
  port: process.env.PORT,
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  salt_round: process.env.SALT_ROUND || 10,
  openRouterApiKey: process.env.OPENROUTER_API_KEY,
  schoolMonthlyFee: process.env.DEFAULT_MONTHLY_FEE,
  jwt: {
    access_secret: process.env.JWT_ACCESS_SECRET,
    access_expire: process.env.JWT_ACCESS_EXPIRE_IN,

    refresh_secret: process.env.JWT_REFRESH_SECRET,
    refresh_expire: process.env.JWT_REFRESH_EXPIRE_IN as StringValue,
  },
  reset_pass_link: process.env.RESET_PASS_LINK,
  emailSender: {
    email: process.env.EMAIL,
    app_pass: process.env.APP_PASS,
  },
  cloudinary: {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  },
};
