import db from "../db";
import { BadRequestError, NotFoundError } from "../expressError"
import { Game, NewGameInterface } from "./game";

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
    let createdGame = await Game.create(newGame);
    expect(createdGame.height).toEqual(7);
    expect(createdGame.width).toEqual(6);
    expect(createdGame.gameState).toEqual(7);

    const result = await db.query(
          `SELECT handle, name, description, num_employees, logo_url
           FROM companies
           WHERE handle = 'new'`);
    expect(result.rows).toEqual([
      {
        handle: "new",
        name: "New",
        description: "New Description",
        num_employees: 1,
        logo_url: "http://new.img",
      },
    ]);
  });
}