const moment = require("moment");
const { query, body, validationResult } = require('express-validator');
const db = require('../models/index');
const util = require('./util');

/**
 * Extract the value located at the given validation path in obj
 * @param obj object
 * @param path string Validation path
 * @returns *
 */
const valueByPath = (obj, path) =>  {
    const pattern = /^(.+)\[([0-9]+)]$/;
    const parts = path.split(".");
    let curr = obj;
    for (let i = 0; i < parts.length; ++i) {
        const part = parts[i];
        const match = part.match(pattern);
        if (match) {
            curr = curr[match[1]][parseInt(match[2])];
        } else {
            curr = curr[part];
        }
    }
    return curr;
};

/**
 * 'path1.path2[1].path3' -> 'path1.path2[1].{last}'
 * @param path
 * @param last
 */
const replacePathLast = (path, last) => {
    let splitted = path.split(".");
    splitted[splitted.length - 1] = last;
    return splitted.join(".");
};

const conditionallyOptional = (builder, isOptional) => {
    return isOptional ? builder.optional() : builder;
};

/** shortcut for conditionallyOptional */
const co = (b, opt) => conditionallyOptional(b, opt);

/**
 * Generate a custom validator that checks whether a
 * @param accepted_values
 * @param [caseSensitive=false]
 * @returns {Function}
 */
exports.valuesIn = function(accepted_values, caseSensitive) {
    caseSensitive = caseSensitive || false;
    if (!caseSensitive) {
        accepted_values = accepted_values.map(s => s.toLowerCase())
    }
    let accepted_set = new Set(accepted_values);
    return values => {
        for (let i = 0; i < values.length; ++i) {
            const v = values[i];
            if (!accepted_set.has(caseSensitive ? v : v.toLowerCase())) {
                throw new Error("Invalid value '" + value + "'. Should be in '" + accepted_values + "'.");
            }
        }
        return true;
    }
};

exports.toMoment = value => moment.utc(value, moment.ISO_8061);

exports.checkIso8601 = value => exports.toMoment(value).isValid();

exports.isAfter = function(other) {
    return (value, { req, location, path }) => {
        const after = exports.toMoment(value);
        const before = exports.toMoment(req[location][other]);
        if (!after.isAfter(before)) {
            throw new Error("'" + other + "' should be before '" + path + "'");
        }
        return true;
    }
};

exports.isPositive = value => {
    return value > 0;
};

exports.isGT = function(v) {
    return value => value > v;
};

exports.isGTE = function(v) {
    return value => value >= v;
};

exports.checkScore = (ranking_method_field, players_field) => {
    return (value, { req, location }) => {
        const ranking_method = req[location][ranking_method_field];
        const players = req[location][players_field];
        const invalid = (ranking_method === db.Game.RANKING_WIN_LOSE && (value !== 0 && value !== 1))
                          || (ranking_method === db.Game.RANKING_NO_POINT && (value <= 0 || value > players.length));
        if (invalid) {
            throw new Error("Invalid score '" + value + "' for ranking method '" + ranking_method + "'");
        }
        return true;
    };
};

/** CHecks whether the parameters is an array of extension of a given board game */
exports.areExpansions = id_board_game_field => {
  return async (value, { req, location }) => {
    const id_board_game = req[location][id_board_game_field];
    if (!id_board_game) {
      throw new Error(`Missing board game information. Cannot determine if expansions are correct.`)
    }
    const expansions = await db.BoardGameExpansion.findAll({where: {id_expanded: id_board_game}});
    const real_expansions = new Set(expansions.map(exp => exp.id_expansion));
    value.forEach(exp => {
      if (!real_expansions.has(exp)) {
        throw new Error(`Invalid expansions. Board game ${exp} is not an expansion of board game ${id_board_game}.`);
      }
    });
    return true;
  };
};

exports.mutuallyExclusive = function(other) {
    return (value, { req, location, path}) => {
        if(!!value ^ !!valueByPath(req[location], replacePathLast(path, other))) {
           return true;
        }
        throw new Error("'id_user' and 'name' fields are mutually exclusive.");
    };
};

exports.model = function(model) {
    return value => model.findByPk(value);
};

/**
 * Get validators for event game
 * @param is_create bool True if the validator should be created for a new game, false of an edited game
 * @returns {*[]}
 */
exports.getGameValidators = function(is_create) {
    return [
        co(body('players'), !is_create).isArray().not().isEmpty(),
        body('players.*.score').isNumeric().custom(exports.checkScore("ranking_method", "players")),
        body('players.*.id_user')
            .custom(exports.mutuallyExclusive("name"))
            .optional({nullable: true}).isNumeric().custom(exports.model(db.User)),
        body('players.*.name')
            .custom(exports.mutuallyExclusive("id_user"))
            .optional({nullable: true}).isString().trim().not().isEmpty(),
        co(body('started_at'), !is_create)
            .custom(exports.checkIso8601)
            .customSanitizer(exports.toMoment),
        co(body('expansions'), !is_create).isArray().custom(exports.areExpansions('id_board_game')),
        body('duration').optional({nullable: true}).isInt().custom(exports.isPositive),
        exports.modelExists(co(body('id_board_game'), !is_create), db.BoardGame),
        co(body('ranking_method'), !is_create).isIn(db.Game.RANKING_METHODS),
        body('id_event').optional({nullable: true}).isInt().custom(exports.isPositive),
        body('comment').optional({nullable: true}).isString()
    ];
};

exports.getEventValidators = function(is_create) {
    return [
        co(body('description'), !is_create).isString(),
        co(body('name'), !is_create).isString().isLength({min: 1}),
        co(body('end'), !is_create)
            .custom(exports.checkIso8601)
            .custom(exports.isAfter('start'))
            .customSanitizer(exports.toMoment),
        co(body('start'), !is_create)
            .custom(exports.checkIso8601)
            .customSanitizer(exports.toMoment),
        body('hide_rankings').optional().isBoolean(),
        co(body('visibility'), !is_create).customSanitizer(s => s.toUpperCase()).isIn(db.Event.VISIBILITIES),
        body('attendees_can_edit').optional().isBoolean().toBoolean(),
        body('invite_required').optional().isBoolean().toBoolean(),
        body('user_can_join').optional().isBoolean().toBoolean()
    ];
};

exports.getTimerValidators = function(is_create) {
    return [
        co(body('timer_type'), !is_create).isString().isIn(db.GameTimer.TYPES),
        body('initial_duration').optional().isInt().custom(exports.isGTE(0)),
        body('current_player').optional().isInt().custom(exports.isGTE(0)),
        body('reload_increment').optional().isInt().custom(exports.isGTE(0)),
        co(body('player_timers'), !is_create).isArray().not().isEmpty(),
        body('player_timers.*.id_user')
            .custom(exports.mutuallyExclusive("name"))
            .optional({nullable: true}).isNumeric().custom(exports.model(db.User)),
        body('player_timers.*.name')
            .custom(exports.mutuallyExclusive("id_user"))
            .optional({nullable: true}).isString().trim().not().isEmpty(),
        body('player_timers.*.color').isString().matches(/^#[a-f0-9]{6}([a-f0-9]{2})?$/i)
    ]
};

exports.getPaginationValidators = function() {
    return [
        query('max_items').optional().isInt({gt: 0}),
        query('start').optional().isInt({gt: -1})
    ];
};

exports.modelExists = (builder, model) => {
    return builder.isNumeric().toInt().custom(exports.model(model));
};

/**
 * Return error response if validation didn't go well
 * @param message Error message to send in case of error
 * @returns {*}
 */
exports.validateOrBlock = function(message) {
    return (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return util.detailErrorResponse(res, 400, message, errors);
        }
        next();
    };
};