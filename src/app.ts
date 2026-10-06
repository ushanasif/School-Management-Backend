import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import router from './app/routes';
import { globalErrorHandler, notFoundHandler } from './app/errorHandler/globalErrorHandler';
import verifyOrigin from "./app/middlewares/verifyOrigin";

const app = express();

app.set("trust proxy", 1);

app.use(cors({
    origin: ["http://localhost:3000"],
    credentials : true,
    methods : ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders : ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use(cookieParser())
app.use(express.urlencoded({ extended: true }));
app.use(verifyOrigin);

app.get("/", (req, res) => {
    res.send("Hello World")
});

app.use("/api/v1", router);


app.use(notFoundHandler)
app.use(globalErrorHandler);

export default app;