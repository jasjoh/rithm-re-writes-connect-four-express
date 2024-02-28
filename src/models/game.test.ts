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
import { createGameWithBoardState, createPlayers } from "./_factories";
import {
  TooFewPlayers, PlayerAlreadyExists,
  InvalidGameState, InvalidPiecePlacement, NotCurrentPlayer
} from "../utilities/gameErrors";
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

// default board dimensions for test games; 6 x 6
const boardDimensions = { width: 6, height: 6 };

describe("create a new game", function () {

  test("create a game successfully", async function () {

    // verify game was returned from creation
    const createdGame = await Game.create(boardDimensions);

    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

    expect(uuidRegex.test(createdGame.id)).toBe(true);
    expect(createdGame.height).toEqual(6);
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

  test("returns default games", async function () {
    const existingGames = await Game.getAll();
    expect(existingGames.length).toEqual(2);
  });

  test("returns all games including newly created ones", async function () {
    await Game.create(boardDimensions);
    const existingGames = await Game.getAll();
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
    const boardState = Game.createInitializedBoard(boardDimensions);
    console.log("board state created:", boardState);
    const players = await createPlayers(1);
    console.log("players created:", players)
    const gameFromFactory = await createGameWithBoardState(boardState, players[0].id);
    console.log("game created using createGameWithBoardState:", gameFromFactory)

    const gameFromClassMethod = await Game.get(gameFromFactory.id);
    console.log("existingGame retrieved using ID from created game:", gameFromClassMethod)
    expect(gameFromClassMethod).toEqual(expect.objectContaining(gameFromFactory));
  });
});

describe("delete game", function () {

  test("deletes default game", async function () {

    let existingGames = await Game.getAll();
    const gameToDeleteId = existingGames[0].id;
    Game.delete(gameToDeleteId);
    existingGames = await Game.getAll();
    expect(existingGames[0].id).not.toEqual(gameToDeleteId);
    expect(existingGames.length).toEqual(1);

  });

});

describe("add player to game", function () {

  test("successfully adds a player", async function () {

    const players = await createPlayers(1);
    const existingGames = await Game.getAll();

    expect(existingGames[0].totalPlayers).toEqual(0);

    await Game.addPlayers([players[0].id], existingGames[0].id);
    const gameWithPlayer = await Game.get(existingGames[0].id);

    expect(gameWithPlayer.totalPlayers).toEqual(1);
  });

  test("throws exception adding existing player", async function () {

    const players = await createPlayers(1);
    const existingGames = await Game.getAll();

    expect(existingGames[0].totalPlayers).toEqual(0);

    await Game.addPlayers([players[0].id], existingGames[0].id);
    const gameWithPlayer = await Game.get(existingGames[0].id);

    expect(gameWithPlayer.totalPlayers).toEqual(1);

    try {
      await Game.addPlayers([players[0].id], existingGames[0].id);
    } catch (error : any) {
      expect(error).toBeInstanceOf(PlayerAlreadyExists);
    }

  });



});

