/** Simple demo Express app. */
import express, { Express, Request, Response, NextFunction } from "express";
import { ExpressError, NotFoundError, BadRequestError } from "./expressError";

import { gamesRouter } from "./routes/games";
import { playersRouter } from "./routes/players";

const app: Express = express();
app.use(express.json());

/** ROUTES BELOW */

app.use("/games", gamesRouter);
app.use("/players", playersRouter);

/** Handle 404 errors -- this matches everything */
app.use(function (req: Request, res: Response, next: NextFunction) {
	console.log("Not Found error");
	throw new NotFoundError();
});

/** Generic error handler; anything unhandled goes here. */
app.use(function (err: ExpressError, req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV !== "test") console.error(err.stack);
  /* istanbul ignore next (ignore for coverage) */
  const status = err.status || 500;
  const message = err.message;

  return res.status(status).json({
    error: { message, status },
  });
});

export default app;