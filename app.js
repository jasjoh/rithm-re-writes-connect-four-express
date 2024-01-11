"use strict";

/** Simple demo Express app. */
const express = require("express");
const app = express();

// useful error class to throw
const { NotFoundError, BadRequestError } = require("./expressError");

// process JSON body => req.body
app.use(express.json());

// process traditional form data => req.body
app.use(express.urlencoded());

/** Handle 404 errors -- this matches everything */
app.use(function (req, res, next) {
	console.log("Not Found error");
	throw new NotFoundError();
});

module.exports = app;