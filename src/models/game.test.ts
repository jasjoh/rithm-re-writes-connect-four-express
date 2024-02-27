import db from "../db";
import { BadRequestError, NotFoundError } from "../expressError"
import {
  Game,
  GameInterface,
  NewGameInterface,
  InitializedBoardType
} from "./game";
import {
  Player,
  NewPlayerInterface,
  PlayerInterface
} from "./player";
import { createGameWithBoardState } from "./_factories";
import { QueryResult } from "pg";

import {
  commonBeforeAll,
  commonBeforeEach,
  commonAfterEach,
  commonAfterAll,
  testGameIds,
  testPlayerIds
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

  test("create a game successfully", async function () {

    // verify game was returned from creation
    const createdGame : GameInterface = await Game.create(newGame);

    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

    expect(uuidRegex.test(createdGame.id)).toBe(true);
    expect(createdGame.height).toEqual(7);
    expect(createdGame.width).toEqual(6);
    expect(createdGame.gameState).toEqual(1);

    // verify game exists in database
    const result : QueryResult<GameInterface> = await db.query(`
      SELECT id
      FROM games
      WHERE id = $1
    `,[createdGame.id]);
    expect(result.rows[0].id).toEqual(createdGame.id);
  });
});

describe("get all games", function () {
  const newGame : NewGameInterface = {
    height: 7,
    width: 6
  };

  test("returns default games", async function () {
    const existingGames : GameInterface[] = await Game.getAll();
    expect(existingGames.length).toEqual(2);
  });

  test("returns all games including newly created ones", async function () {
    await Game.create(newGame);
    const existingGames : GameInterface[] = await Game.getAll();
    expect(existingGames.length).toEqual(3);
  });
});

describe("get game details", function () {

  test("returns default game", async function () {
    const expectedGame : GameInterface = {
      id: testGameIds[0],
      width: expect.any(Number),
      height: expect.any(Number),
      gameState: 1,
      placedPieces: null,
      board: null,
      winningSet: null,
      currPlayerId: null,
      createdOn: expect.any(Date),
      totalPlayers: expect.any(Number)
    }
    const existingGame = await Game.get(testGameIds[0]);
    expect(existingGame).toEqual(expectedGame);
  });

  test("returns initialized game", async function () {
    const boardDimension = { width: 6, height: 6 };
    const boardState = Game.createInitializedBoard(boardDimension);
    console.log("board state created:", boardState);

    const playerData = {
      name: 'foobar',
      color: '#2b2b2b',
      ai: false
    };
    const player = await Player.create(playerData);
    const gameFromFactory = await createGameWithBoardState(boardState, player.id);
    console.log("game created using createGameWithBoardState:", gameFromFactory)

    const gameFromClassMethod = await Game.get(gameFromFactory.id);
    console.log("existingGame retrieved using ID from created game:", gameFromClassMethod)
    expect(gameFromClassMethod).toEqual(expect.objectContaining(gameFromFactory));
  });

});

