"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/** Simple demo Express app. */
const express_1 = __importDefault(require("express"));
const app = (0, express_1.default)();
const gamesRoutes = require('./routes/games');
const playersRoutes = require('./routes/players');
// useful error class to throw
const { NotFoundError, BadRequestError } = require("./expressError");
// process JSON body => req.body
app.use(express_1.default.json());
/** ROUTES BELOW */
app.use("/games", gamesRoutes);
app.use("/players", playersRoutes);
/** Handle 404 errors -- this matches everything */
app.use(function (req, res, next) {
    console.log("Not Found error");
    throw new NotFoundError();
});
/** Generic error handler; anything unhandled goes here. */
app.use(function (err, req, res, next) {
    if (process.env.NODE_ENV !== "test")
        console.error(err.stack);
    /* istanbul ignore next (ignore for coverage) */
    const status = err.status || 500; // TODO: define interface in expressError.js
    const message = err.message;
    return res.status(status).json({
        error: { message, status },
    });
});
module.exports = app;
