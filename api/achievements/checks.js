const db = require("../models/index");

const C = {
  COUNT: { // count entries
    make_query_fn(table, user_field, options) {
      let ufield = user_field === undefined ? "id_user" : user_field;
      return (id_user) => {
        return table.count({where: {[ufield]: id_user}, ...options});
      };
    }
  },
  COUNT_JOIN: { // count entries filtered based on a join (the other relation contains the user information)
    make_query_fn(table, include_table, as, number, user_field, options) {
      let ufield = user_field === undefined ? "id_user" : user_field;
      return (id_user) => {
        return table.count({
          include: [{ model: include_table, as, where: {[ufield]: id_user}, required: true }],
          ... options
        });
      };
    }
  }
};

exports.CONDITION_TYPES = C;
exports.C = C;

/** Check whether the count returned by the count promise is greater or equal to the number */
exports.check_count_fn = (count_promise, number) => {
  return async (id_user) => {
    let promise = count_promise(id_user);
    return (await promise) >= number;
  };
};

exports.false_check = async (id_user) => {
  return false;
};

/**
 * Check functions
 */

/**
 * @param id_user
 * @param count_cond Given a game, the list of scores and a reference score, return true if the reference score should
 * be considered in the count.
 */
exports.game_count_condition = async (id_user, count_cond) => {
  let games = await db.Game.findAll({ include: {model: db.GamePlayer, as: "player", where: {id_user}, required: true} });
  let players = await db.GamePlayer.findAll({ where: {id_game: {[db.Op.in]: games.map(g => g.id)}} });
  let game2players = {};
  players.forEach(p => {
    if (!game2players[p.id_game]) {
      game2players[p.id_game] = [];
    }
    game2players[p.id_game].push(p);
  });
  console.log(games);
  console.log(game2players);

  let count = 0;
  games.forEach(game => {
    let players = game2players[game.id];
    const player_score = game.players[0].score;
    const scores = players.map(p => p.score);
    count += count_cond(game, scores, player_score) ? 1 : 0;
  });
  console.log(count);
  return count;
};

const victory_cond = (game, scores, ref_score) => {
  if (db.Game.RANKING_LOWER_BETTER) {
    return ref_score === Math.min(...scores);
  } else if (db.Game.RANKING_HIGHER_BETTER) {
    return ref_score === Math.max(...scores);
  } else if (db.Game.RANKING_WIN_LOSE) {
    return ref_score === 1;
  }
};

exports.game_won_count = async (id_user) => {
  return await exports.game_count_condition(id_user, victory_cond);
};

exports.game_lost_count = async (id_user) => {
  return await exports.game_count_condition(id_user, (game, scores, ref_score) => !victory_cond(game, scores, ref_score));
};

exports.bga_played_count = C.COUNT_JOIN.make_query_fn(db.Game, db.GamePlayer, "player", "id_user", { group: "id_board_game" });
exports.game_played_count = C.COUNT.make_query_fn(db.GamePlayer);
exports.bga_owned_count = C.COUNT.make_query_fn(db.LibraryGame);
exports.event_attended_count = C.COUNT.make_query_fn(db.EventAttendee);


