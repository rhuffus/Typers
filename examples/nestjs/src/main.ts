import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.js";

const app = await NestFactory.create(AppModule);
await app.listen(Number(process.env.PORT ?? 3000), "127.0.0.1");
