const db = require("./models/index");
const util = require("./util/util");
const includes = require("./util/db_include");

exports.gameFullIncludesSQ = [
    includes.defaultBoardGameIncludeSQ,
    includes.genericIncludeSQ(db.GamePlayer, "game_players", [includes.defaultUserIncludeSQ])
];

/**
 * Validate ranks from the list
 */
exports.validateRanks = (ranking_method, ranks) => {
    if (ranking_method === "WIN_LOSE") {
        for (let i = 0; i < ranks.length; ++i) {
            if (ranks[i] !== 0 && ranks[i] !== 1) {
                return {valid: false, error: "Invalid rank '" + ranks[i] + "'"};
            }
        }
    } else if (ranking_method !== "POINTS_LOWER_BETTER"
        && ranking_method !== "POINTS_HIGHER_BETTER") {
        return {valid: false, error: "Invalid ranking method '" + ranking_method + "'"};
    }
    return {valid: true};
};

/**
 * Check whether players are correct
 */
exports.validateGamePlayers = (players) => {
    for (let i = 0; i < players.length; ++i) {
        if (!(players[i].hasOwnProperty("user") && players[i].user > 0)  // TODO validate user ids by checking in db
                && !(players[i].hasOwnProperty("name") && players[i].name.length > 0)) {
            return {valid: false, error: "Invalid player. Missing or invalid fields 'name' or 'user'."};
        }
    }
    return {valid: true};
};

const fromGamePlayersToRanks = function(game) {
    game.dataValues.players = exports.rankForGame(game);
    game.dataValues.game_players = undefined; // to keep the more intuitive "players" label in json
    return game;
};

exports.buildFullGame = (gameId, res) => {
    return util.sendModelOrError(res, db.Game.find({
        where: {id: gameId},
        include: exports.gameFullIncludesSQ
    }), g => fromGamePlayersToRanks(g));
};

const preprocessGameData = function(body) {
    let data = {
        players: body.players,
        id_board_game: body.id_board_game,
        ranking_method: body.ranking_method,
        duration: body.duration || null,
        has_players: body.players !== undefined && body.players.length > 0
    };

    if (data.has_players) {
        data.ranking_validation = exports.validateRanks(
            body.ranking_method,
            body.players.map((item) => { return item.score; })
        );
        data.players_validation = exports.validateGamePlayers(body.players);
    }

    return data;
};

const getGamePlayerData = function(game, validated_players) {
    return validated_players.map((item) => {
        return {
            id_game: game.id,
            score: item.score,
            id_user: item.user || null,
            name: item.name || null
        };
    });
};

/**
 * Execute the addition of a game
 * @param eid Event id or null.
 * @param req
 * @param res
 * @returns {*}
 */
exports.addGameQuery = function(eid, req, res) {
    const game_data = preprocessGameData(req.body);
    if (!game_data.has_players) {
        return util.detailErrorResponse(res, 400, "missing players");
    }
    if (!game_data.ranking_validation.valid) {
        return util.detailErrorResponse(res, 400, game_data.ranking_validation.error);
    }
    if (!game_data.players_validation.valid) {
        return util.detailErrorResponse(res, 400, game_data.players_validation.error);
    }
    return db.sequelize.transaction(t => {
        return db.Game.create({
            id_event: eid,
            id_board_game: game_data.id_board_game,
            duration: game_data.duration,
            ranking_method: game_data.ranking_method
        }, {transaction: t}).then((game) => {
            const player_data = getGamePlayerData(game, game_data.players);
            return db.GamePlayer.bulkCreate(player_data, {
                returning: true,
                transaction: t
            }).then(players => {
                return game;
            });
        })
    }).then(game => {
        return exports.buildFullGame(game.id, res);
    }).catch(err => {
        return util.errorResponse(res);
    });
};

exports.addGame = function (req, res) {
    return exports.addGameQuery(req.body.id_event || null, req, res);
};

exports.addEventGame = function(req, res) {
    return exports.addGameQuery(parseInt(req.params.eid), req, res);
};

exports.updateEventGame = function(req, res) {
    let gid = parseInt(req.params.gid);
    let eid = parseInt(req.params.eid);
    const game_data = preprocessGameData(req.body);
    if (game_data.has_players && !game_data.ranking_validation.valid) {
        return util.detailErrorResponse(res, 400, game_data.ranking_validation.error);
    }
    if (game_data.has_players && !game_data.players_validation.valid) {
        return util.detailErrorResponse(res, 400, game_data.players_validation.error);
    }
    return db.sequelize.transaction(t => {
        return db.Game.findById(gid, {transaction: t})
            .then(game => {
                return db.Game.update({
                    id_board_game: game_data.id_board_game || game.id_board_game,
                    duration: game_data.duration || game.duration,
                    ranking_method: game_data.ranking_method || game.ranking_method,
                    id_event: req.body.id_event || eid
                }, {
                    where: {id: game.id, id_event: eid},
                    transaction: t
                }).then(updated => {
                    if (game_data.has_players) {
                        return db.GamePlayer.destroy({
                            transaction: t,
                            where: {id_game: game.id}
                        }).then(deleted => {
                            const playersData = getGamePlayerData(game, game_data.players);
                            return db.GamePlayer.bulkCreate(playersData, {
                                transaction: t
                            }).then(players => { return game; });
                        });
                    } else {
                        return game;
                    }
                })
            });
    }).then(game => {
        return exports.buildFullGame(game.id, res);
    }).catch(err => {
        return util.errorResponse(res);
    });
};

exports.rankForGame = function(game) {
    return util.rank(game.game_players, (player) => player.score, game.ranking_method === "POINTS_LOWER_BETTER");
};

exports.sendAllGamesFiltered = function (filtering, res, options) {
    if (!options) {
        options = {};
    }
    return util.sendModelOrError(res, db.Game.findAll(Object.assign(options, {
        where: filtering,
        include: exports.gameFullIncludesSQ
    })), games => {
        return games.map(g => fromGamePlayersToRanks(g));
    });
};

exports.getGames = function (req, res) {
    // no filtering
    return exports.sendAllGamesFiltered(undefined, res);
};

exports.getGame = function (req, res) {
    return exports.buildFullGame(parseInt(req.params.gid), res);
};

exports.deleteGame = function (req, res) {
    const gid = parseInt(req.params.gid);
    return util.handleDeletion(res, db.sequelize.transaction(res, (t) => {
        return db.GamePlayer.destroy({
            where: {id_game: gid}
        }).then(() => {
            return db.Game.destroy({where: {id: gid}}, {transaction: t});
        });
    }));
};

exports.getEventGames = function(req, res) {
    return exports.sendAllGamesFiltered({id_event: parseInt(req.params.eid)}, res)
};

exports.getRecentEventGames = function(req, res) {
    return exports.sendAllGamesFiltered({
        id_event: parseInt(req.params.eid)
    }, res, {
        order: [["createdAt", "DESC"]],
        limit: req.query.count || 10
    });
};