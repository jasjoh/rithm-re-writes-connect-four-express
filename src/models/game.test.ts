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
import { randomUUID } from "crypto";
import exp from "constants";

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
    expect(createdGame.gameState).toEqual(0);

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
      gameState: 0,
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
    // console.log("board state created:", boardState);
    const players = await createPlayers(1);
    // console.log("players created:", players)
    const gameFromFactory = await createGameWithBoardState(boardState, players[0].id);
    // console.log("game created using createGameWithBoardState:", gameFromFactory)

    const gameFromClassMethod = await Game.get(gameFromFactory.id);
    // console.log("existingGame retrieved using ID from created game:", gameFromClassMethod)
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

    const playerCount = await Game.addPlayers([players[0].id], existingGames[0].id);
    expect(playerCount).toEqual(1);

    const gameWithPlayer = await Game.get(existingGames[0].id);
    expect(gameWithPlayer.totalPlayers).toEqual(1);
  });

  test("throws exception adding existing player", async function () {

    const players = await createPlayers(1);
    const existingGames = await Game.getAll();
    expect(existingGames[0].totalPlayers).toEqual(0);

    const playerCount = await Game.addPlayers([players[0].id], existingGames[0].id);
    expect(playerCount).toEqual(1);

    const gameWithPlayer = await Game.get(existingGames[0].id);
    expect(gameWithPlayer.totalPlayers).toEqual(1);

    try {
      await Game.addPlayers([players[0].id], existingGames[0].id);
    } catch (error : any) {
      expect(error).toBeInstanceOf(PlayerAlreadyExists);
    }
  });

});

describe("remove player from game", function () {

  test("successfully remove a player", async function () {

    const players = await createPlayers(1);
    const existingGames = await Game.getAll();
    expect(existingGames[0].totalPlayers).toEqual(0);

    let playerCount = await Game.addPlayers([players[0].id], existingGames[0].id);
    expect(playerCount).toEqual(1);

    playerCount = await Game.removePlayer(players[0].id, existingGames[0].id);
    expect(playerCount).toEqual(0);

  });

  test("throws exception removing non-existing player", async function () {

    const existingGames = await Game.getAll();
    expect(existingGames[0].totalPlayers).toEqual(0);

    try {
      await Game.removePlayer(randomUUID(), existingGames[0].id);
    } catch (error : any) {
      expect(error).toBeInstanceOf(NotFoundError);
    }
  });

});

describe("get list of players in game", function () {

  test("successfully get list of players", async function () {

    const players = await createPlayers(2);
    const existingGames = await Game.getAll();
    expect(existingGames[0].totalPlayers).toEqual(0);

    await Game.addPlayers([players[0].id], existingGames[0].id);
    await Game.addPlayers([players[1].id], existingGames[0].id);

    const addedPlayers = await Game.getPlayers(existingGames[0].id);
    expect(addedPlayers.length).toEqual(2);

  });

});

describe("start a game", function () {

  test("successfully updates game state", async function () {

    const players = await createPlayers(2);
    const existingGames = await Game.getAll();
    const gameToStart = existingGames[0];

    expect(gameToStart.gameState).toEqual(0);

    await Game.addPlayers([players[0].id], gameToStart.id);
    await Game.addPlayers([players[1].id], gameToStart.id);
    await Game.start(gameToStart.id, false);

    const startedGame = await Game.get(gameToStart.id);
    expect(startedGame.gameState).toEqual(1);
  });

  test("throws error if no game exists", async function () {
    try {
      await Game.start(randomUUID(), false);
    } catch(error : any) {
      expect(error).toBeInstanceOf(NotFoundError);
    }
  });

  test("throws error if too few players", async function () {

    const players = await createPlayers(1);
    const existingGames = await Game.getAll();
    const gameToStart = existingGames[0];

    expect(gameToStart.gameState).toEqual(0);

    await Game.addPlayers([players[0].id], gameToStart.id);

    try {
      await Game.start(gameToStart.id, false);
    } catch(error : any) {
      expect(error).toBeInstanceOf(TooFewPlayers);
    }
  });

  test("does not start a turn when instructed not to", async function () {

    const players = await createPlayers(2);
    const existingGames = await Game.getAll();
    const gameToStart = existingGames[0];

    expect(gameToStart.gameState).toEqual(0);

    await Game.addPlayers([players[0].id], gameToStart.id);
    await Game.addPlayers([players[1].id], gameToStart.id);
    await Game.start(gameToStart.id, false);

    const startedGame = await Game.get(gameToStart.id);
    expect(startedGame.currPlayerId).toBeNull();

    const gamePlayers = await Game.getPlayers(gameToStart.id);
    for (let gp of gamePlayers) {
      expect(gp.playOrder).toBeNull()
    }
  });

  test("starts a turn when NOT instructed not to", async function () {

    const players = await createPlayers(2);
    const existingGames = await Game.getAll();
    const gameToStart = existingGames[0];

    expect(gameToStart.gameState).toEqual(0);

    await Game.addPlayers([players[0].id], gameToStart.id);
    await Game.addPlayers([players[1].id], gameToStart.id);
    await Game.start(gameToStart.id);

    const startedGame = await Game.get(gameToStart.id);
    expect(startedGame.currPlayerId).not.toBeNull();

    const gamePlayers = await Game.getPlayers(gameToStart.id);
    for (let gp of gamePlayers) {
      expect(gp.playOrder).not.toBeNull()
    }
  });

});

describe("drops piece", function () {

  test("successfully drop piece", async function () {

    // setup a game and start it
    const players = await createPlayers(2);
    const games = await Game.getAll();
    let game = games[0];
    await Game.addPlayers([players[0].id], game.id);
    await Game.addPlayers([players[1].id], game.id);
    await Game.start(game.id);
    game = await Game.get(game.id);
    const currPlayerId = game.currPlayerId as string;

    await Game.dropPiece(game.id, currPlayerId, 0);
    game = await Game.get(game.id);

    // test game board
    const gameBoard = game.board as InitializedBoardType;
    const cellToTest = gameBoard[gameBoard.length - 1][0];
    expect(cellToTest.playerId).toBe(currPlayerId);

    // test placed pieces
    const placedPieces = game.placedPieces as number[][];
    expect(placedPieces[0]).toEqual([gameBoard.length - 1, 0]);

  });

});


describe("game turns retrieval", function () {

  test("successfully return no turn when not have transpired", async function () {

    const games = await Game.getAll();
    let game = games[0];
    expect(await Game.getTurns(game.id)).toEqual([]);
  });

  test("successfully returns correct number of turns", async function () {

    // setup a game, start it and take a turn
    const players = await createPlayers(2);
    const games = await Game.getAll();
    let game = games[0];
    await Game.addPlayers([players[0].id], game.id);
    await Game.addPlayers([players[1].id], game.id);
    await Game.start(game.id);
    game = await Game.get(game.id);
    const currPlayerId = game.currPlayerId as string;
    await Game.dropPiece(game.id, currPlayerId, 0);

    const gameTurns = await Game.getTurns(game.id);
    expect(gameTurns.length).toBe(1);
  });

});




