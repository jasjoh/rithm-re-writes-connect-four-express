"use strict";

/** Simple demo Express app. */
const express = require("express");
const app = express();

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
app.use(function (req, res, next) {
	console.log("Not Found error");
	throw new NotFoundError();
});

module.exports = app;