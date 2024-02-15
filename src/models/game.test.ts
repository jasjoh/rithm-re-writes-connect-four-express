import db from "../db";
import { BadRequestError, NotFoundError } from "../expressError"
import { Game, GameInterface, NewGameInterface } from "./game";
import { QueryResult } from "pg";

import {
  commonBeforeAll,
  commonBeforeEach,
  commonAfterEach,
  commonAfterAll,
} from "./_testCommon";

beforeAll(commonBeforeAll);
beforeEach(commonBeforeEach);
afterEach(commonAfterEach);
afterAll(commonAfterAll);

describe("create a new game", function () {
  const newGame : NewGameInterface = {
    height: 7,
    width: 6
  };

  test("works under expected usage", async function () {

    // verify game was returned from creation
    let createdGame : GameInterface = await Game.create(newGame);

    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

    expect(uuidRegex.test(createdGame.id)).toBe(true);
    expect(createdGame.height).toEqual(7);
    expect(createdGame.width).toEqual(6);
    expect(createdGame.gameState).toEqual(1);

    // verify game exists in database
    let result : QueryResult<GameInterface> = await db.query(`
      SELECT id
      FROM games
      WHERE id = $1
    `,[createdGame.id]);
    expect(result.rows[0].id).toEqual(createdGame.id);
  });
});