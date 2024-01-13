/** Simple demo Express app. */
import express, { Express, Request, Response, NextFunction } from "express";
const app: Express = express();

const gamesRoutes = require('./routes/games');
const playersRoutes = require('./routes/players');

// useful error class to throw
const { NotFoundError, BadRequestError } = require("./expressError");

// process JSON body => req.body
app.use(express.json());

/** ROUTES BELOW */

app.use("/games", gamesRoutes);
app.use("/players", playersRoutes);

/** Handle 404 errors -- this matches everything */
app.use(function (req: Request, res: Response, next: NextFunction) {
	console.log("Not Found error");
	throw new NotFoundError();
});

/** Generic error handler; anything unhandled goes here. */
app.use(function (err: any, req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV !== "test") console.error(err.stack);
  /* istanbul ignore next (ignore for coverage) */
  const status = err.status || 500; // TODO: define interface in expressError.js
  const message = err.message;

  return res.status(status).json({
    error: { message, status },
  });
});

module.exports = app;