'use strict';

const config = require("./config/config.js");
const jwt = require("jsonwebtoken");
const userutil = require("./util/user");
const util = require("./util/util");
const db = require("./models/index");
const _ = require("lodash");

module.exports = function(app) {
    const { body, param, check } = require('express-validator/check');
    const { asyncMiddleware } = require('./util/util');
    const validation = require('./util/validation');
    const BoardGameController = require("./BoardGameController");
    const GameController = require("./GameController");
    const StatsController = require("./StatsController");
    const UserController = require("./UserController");
    const EventController = require("./EventController");
    const AdminController = require("./AdminController");
    const TimerController = require("./TimerController");

    /**
     * @apiDefine TokenHeaderRequired
     *
     * @apiHeader {String} Authentication User authentication token `JWT {token}`
     */

    /**
     * @apiDefine SourceParameter
     *
     * @apiParam {String} source The source identifier. Currently, only supports 'bgg'.
     * @apiParam {Number} id Board game identifier on the source platform.
     */

    /**
     * @apiDefine DBDatetimeFields
     * @apiSuccess {String} createdAt Creation datetime of the resource (ISO8601, UTC)
     * @apiSuccess {String} updatedAt Latest update datetime of the resource (ISO8061, UTC)
     */

    /**
     * @apiDefine UserDescriptor
     *
     * @apiSuccess {Number} id User id
     * @apiSuccess {String} name User name
     * @apiSuccess {String} surname User surname
     * @apiSuccess {String} username User username
     * @apiSuccess {Boolean} admin True if the user is an admin, false otherwise
     * @apiSuccess {String} email User email
     */

    /**
     * @apiDefine EventDescriptor
     *
     * @apiSuccess {Number} id Event identifier
     * @apiSuccess {String} name Event name
     * @apiSuccess {String} start Start date (ISO8601, UTC)
     * @apiSuccess {String} end End date (ISO8601, UTC)
     * @apiSuccess {String} description Event description
     * @apiSuccess {Number} id_creator Event creator user identifier
     * @apiSuccess {Boolean} hide_rankings True if rankings should be hidden, false otherwise
     */

    /**
     * @apiDefine FullGameDescriptor
     *
     * @apiSuccess {Number} id Game identifier
     * @apiSuccess {String} duration Game duration, or `null`.
     * @apiSuccess {String} id_board_game Played board game identifier
     * @apiSuccess {String} id_event Event identifier, or `null`.
     * @apiSuccess {String} ranking_method The ranking method for the game. One of: `{WIN_LOSE, POINTS_LOWER_BETTER, POINTS_HIGHER_BETTER}`.
     * @apiSuccess {BoardGame} board_game Board game data (see "Add board game" request for structure).
     * @apiSuccess {Player[]} players List of players involved in the game.
     * @apiSuccess {Number} players.id Game player identifier
     * @apiSuccess {Number} players.score Player score
     * @apiSuccess {Number} players.id_user Player user identifier (mutually exclusive with `name`), or `null`.
     * @apiSuccess {User} players.user If `id_user` is not `null`, user data (see 'Get current user' request for user
     * structure)
     * @apiSuccess {String} players.name Player name if the player is not registered on the application (mutually
     * exclusive with `user`), or `null`.
     */

    /**
     * @apiDefine FullEventDescriptor
     *
     * @apiSuccess {Number} id Event id
     * @apiSuccess {String} name Event name
     * @apiSuccess {String} start Start datetime (ISO8601, UTC)
     * @apiSuccess {String} end End datetime(ISO8601, UTC)
     * @apiSuccess {String} description Event description
     * @apiSuccess {Boolean} hide_rankings True if rankings should be hidden, false otherwise
     * @apiSuccess {Number} id_creator Event creator user identifier
     * @apiSuccess {User} creator Creator user data (see 'Get current user' request for user structure)
     * @apiSuccess {Attendee[]} attendees List of event attendees
     * @apiSuccess {ProvidedBoardGame[]} provided_board_games List of board games provided by attendees to the event.
     */

    /**
     * @apiDefine BoardGameDescriptor

     * @apiSuccess {Number} id Board game identifier
     * @apiSuccess {String} name Board game name
     * @apiSuccess {Number} bgg_id BGG identifier of the board game
     * @apiSuccess {Number} bgg_score Score of the game on BGG
     * @apiSuccess {String} gameplay_video_url URL of a gameplay/rule video (can be `null`)
     * @apiSuccess {Number} min_players Minimum number of players
     * @apiSuccess {Number} max_players Maximum number of players
     * @apiSuccess {Number} min_playing_time Minimum playing time
     * @apiSuccess {Number} max_playing_time Maximum playing time
     * @apiSuccess {Number} playing_time Board game official playing time
     * @apiSuccess {String} thumbnail URL of the board game thumbnail image
     * @apiSuccess {String} image URL of the board game image
     * @apiSuccess {String} description Description of the board game
     * @apiSuccess {Number} year_published Board game publication year
     * @apiSuccess {String} category Comma-separated list of categories the game belongs to.
     * @apiSuccess {String} mechanic Comma-separated list of mechanics the game belongs to.
     * @apiSuccess {String} family  Comma-separated list of families the game belongs to.
     *
     */

    /**
     * @apiDefine EventListDescriptor
     * @apiSuccess {Event[]} events List of events. See "Create event" request for event object structure. Note: the
     * returned data is a list (not an actual object).
     */

    /**
     * @apiDefine TimerListDescriptor
     * @apiSuccess {Timer[]} timers List of timers. See "Create timer" request for timer object structure. Note: the
     * returned data is a list (not an actual object).
     */

    /**
     * @apiDefine LibraryBoardGamesListDescriptor
     * @apiSuccess {LibraryBoardGame[]} library_board_games List of library board games. Note: the
     * returned data is a list (not an actual object).
     * @apiSuccess {Number} library_board_games.id_user User (the library belongs to) identifier
     * @apiSuccess {Number} library_board_games.id_board_game Library board game identifier.
     * @apiSuccess {BoardGame} library_board_games.board_game Board game data (see "Add board game" request for structure)
     * @apiSuccess {String} library_board_games.createdAt Creation datetime of the resource (ISO8601, UTC)
     * @apiSuccess {String} library_board_games.updatedAt Latest update datetime of the resource (ISO8061, UTC)
     */

    /**
     * @apiDefine ProvidedBoardGamesListDescriptor
     * @apiSuccess {ProvidedBoardGame[]} provided_board_games List of provided board games. Note: the
     * returned data is a list (not an actual object).
     * @apiSuccess {Number} provided_board_games.id_user User (who provided the board game at the event) identifier
     * @apiSuccess {Number} provided_board_games.id_event Event (the board game is provided at) identifier.
     * @apiSuccess {Number} provided_board_games.id_board_game Provided board game identifier.
     * @apiSuccess {User} provided_board_games.provider Provider user data (see 'Get current user' request for user structure)
     * @apiSuccess {BoardGame} provided_board_games.board_game Board game data (see "Add board game" request for structure)
     * @apiSuccess {String} provided_board_games.createdAt Creation datetime of the resource (ISO8601, UTC)
     * @apiSuccess {String} provided_board_games.updatedAt Latest update datetime of the resource (ISO8061, UTC)
     */

    /**
     * @apiDefine TimerDescriptor
     *
     * @apiSuccess {Number} id Timer identifier
     * @apiSuccess {Number} id_game Game identifier (or null if not tied to a game)
     * @apiSuccess {Game} game Game data (see 'Get game' request for game structure).
     * @apiSuccess {String} timer_type Type of timer. One of: 'COUNT_UP', 'COUNT_DOWN' or 'RELOAD'
     * @apiSuccess {Number} id_creator Identifier of the user who has created the timer.
     * @apiSuccess {User} creator User data (see 'Get current user' request for user structure)
     * @apiSuccess {Number} initial_duration Number of millisecond that each player's timer should start from.
     * @apiSuccess {PlayerTimer[]} player_timers The individual player timers
     * @apiSuccess {Number} player_timers.id_timer Timer identifier.
     * @apiSuccess {Number} player_timers.id_user Player user identifier (mutually exclusive with `name`), or `null`.
     * @apiSuccess {User} player_timers.user If `id_user` is not `null`, user data (see 'Get current user' request for user
     * structure)
     * @apiSuccess {String} player_timers.name Player name if the player is not registered on the application (mutually
     * exclusive with `user`), or `null`.
     * @apiSuccess {Number} player_timers.color Player's color (hexcode, e.g.: `#ffffff`).
     * @apiSuccess {Number} player_timers.elapsed Number of millisecond elapsed since the beginning of the player's timer.
     * @apiSuccess {Number} player_timers.start Start datetime of the player's timer (iso8601, UTC), or `null` if this timer is not running.
     * @apiSuccess {Boolean} player_timers.running `true` if the player's timer is running, `false` otherwise.
     */

    /**
     * @apiDefine SuccessObjDescriptor
     * @apiSuccess {Boolean} success True if success
     */

    /**
     * @apiDefine ErrorDescriptor
     * @apiError {String} message General error message
     * @apiError {Boolean} success `false`, indicate that the request has failed
     * @apiError {Error[]} [errors] List of errors
     * @apiError {String} errors.location Location of the parameter (e.g. `body`)
     * @apiError {String} errors.msg Description for this error
     * @apiError {String} errors.param Name of the erroneous parameter
     */

    /**
     * @apiDefine PaginationParameters
     * @apiParam (query) {Number} [max_items] Maximum number of items to return
     * @apiParam (query) {Number} [start] Pagination offset (resources are sorted by decreasing creation time)
     */

    // User routes
    /**
     * @api {post} /user Register user
     * @apiName UserRegister
     * @apiGroup User
     * @apiDescription Create a new user. The created user must be authorized by an admin before being able to access
     * the application data.
     *
     * @apiUse UserDescriptor
     * @apiUse DBDatetimeFields
     */
    app.route("/user")
        .post(UserController.register);

    /**
     * @api {post} /user/login Authenticate user
     * @apiName Login
     * @apiGroup Authentication
     * @apiDescription Authenticate a user, returns a Json Web Token (JWT) to pass along with other requests.
     *
     * @apiSuccess {String} token JSON Web Token
     */
    app.route("/user/login")
        .post(UserController.signIn);

    // authentication middleware, applied to all except login and register
    app.use(/^\/(?!user\/register|user\/login).*/, asyncMiddleware(async function(req, res, next) {
        let token = userutil.getToken(req);
        if (!token) {
            return util.detailErrorResponse(res, 401, "No token provided.");
        }
        const verified = jwt.verify(token, config.jwt_secret_key, (error, decoded) => { return {error, decoded}; });
        if (verified.error) {
            return util.detailErrorResponse(res, 401, "Failed to authenticate token.");
        }
        try {
            const user = await db.User.findByPk(verified.decoded.id);
            if (!user.validated){
                return util.detailErrorResponse(res, 403, UserController.notValidatedErrorMsg);
            }
            req.decoded = verified.decoded;
            req.is_admin = user.admin;
            next();
        } catch(err) {
            console.log(err);
            return util.detailErrorResponse(res, 401, "Unknown user.");
        }
    }));

    // User (protected)
    /**
     * @api {get} /user/current Get current user
     * @apiName GetCurrentUser
     * @apiGroup User
     * @apiDescription Get current user data.
     * @apiUse TokenHeaderRequired
     *
     * @apiUse UserDescriptor
     * @apiUse DBDatetimeFields
     */
    app.route("/user/current")
        .get(UserController.getCurrentUser);

    /**
     * @api {put} /user/:id Update user
     * @apiName UpdateUser
     * @apiGroup User
     * @apiDescription Update user data.
     * @apiUse TokenHeaderRequired
     *
     * @apiParam {Number} id User identifier
     * @apiUse UserDescriptor
     * @apiUse DBDatetimeFields
     */
    app.route("/user/:uid")
        .put(UserController.updateUser);

    /**
     * @api {get} /user/:id/stats Get user stats
     * @apiName GetUserStats
     * @apiGroup User
     * @apiDescription Get user statistics
     * @apiUse TokenHeaderRequired
     * @apiParam {Number} id User identifier
     * @apiSuccess {Number} played Number of games played so far.
     * @apiSuccess {Number} attended Number of events attended.
     * @apiSuccess {Number} owned Number of distinct board games owned.
     * @apiSuccess {Object} most_played Most played board game
     * @apiSuccess {Number} most_played.count Number of times played
     * @apiSuccess {BoardGame} most_played.board_game Board game data (see "Add board game" request for structure), `null` if no game played.
     * @apiSuccess {Number} play_time Total play time of the user (in minutes)
     */
    app.route("/user/:uid/stats")
        .get(UserController.getUserStats);

    /**
     * @api {get} /user/:id/activities Get user activities
     * @apiName GetUserActivities
     * @apiGroup User
     * @apiDescription Get user latest activities on the application
     * @apiUse TokenHeaderRequired
     * @apiParam {Number} id User identifier
     *
     * @apiSuccess {Activity[]} activities List of activities. Note: the returned data is a list (not an actual object).
     * @apiSuccess {String} activities.type Type of activities among: `{'user/join_event', 'user/play_game', 'user/library_add'}`.
     * @apiSuccess {String} activities.datetime When the activity occurred (iso8601, UTC)
     * @apiSuccess {BoardGame} activities.board_game (only for `user/play_game` and `user/library_add` activities) Board game data
     * (see "Add board game" request for structure).
     * @apiSuccess {Event} activities.event (only for `user/join_event` activity) Event data (see "Add event game" for Game structure).
     */
    app.route("/user/:uid/activities")
        .get(UserController.getUserActivities);

    // Library
    /**
     * @api {get} /user/library_games Get library
     * @apiName GetCurrentUserLibrary
     * @apiGroup User library
     * @apiDescription Get the current user's board game library.
     * @apiUse TokenHeaderRequired
     * @apiUse LibraryBoardGamesListDescriptor
     */

    /**
     * @api {post} /user/library_games Add to library
     * @apiName AddBoardGameToLibrary
     * @apiGroup User library
     * @apiDescription Add a board game to the current user library.
     * @apiUse TokenHeaderRequired
     * @apiParam {Number[]} board_games List of identifiers of the board games to add to the user library.
     *
     * @apiUse LibraryBoardGamesListDescriptor
     */

    /**
     * @api {delete} /user/library_games Delete from library
     * @apiName DeleteBoardGameFromLibrary
     * @apiGroup User library
     * @apiDescription Delete a board game from the current user library.
     * @apiUse TokenHeaderRequired
     *
     * @apiUse LibraryBoardGamesListDescriptor
     */
    app.route("/user/library_games")
        .get(UserController.getCurrentUserLibraryGames)
        .post(UserController.addLibraryGames)
        .delete(UserController.deleteLibraryGames);

    /**
     * @api {post} /user/library_games/:source/:id Add to library from source
     * @apiName AddBoardGameFromSourceToLibrary
     * @apiGroup User library
     * @apiDescription Add a new board game from the given source to the application, then add this game to the current
     * user library.
     * @apiUse SourceParameter
     * @apiUse TokenHeaderRequired
     * @apiUse LibraryBoardGamesListDescriptor
     */
    app.route("/user/library_game/:source/:id")
        .post(UserController.addBoardGameAndAddToLibrary);

    /**
     * @api {get} /user/:id/library_games Get user library
     * @apiName GetUserLibrary
     * @apiGroup User library
     * @apiDescription Get the specified user's board game library.
     * @apiParam {Number} id User identifier.
     * @apiUse TokenHeaderRequired
     * @apiUse LibraryBoardGamesListDescriptor
     */
    app.route("/user/:uid/library_games")
        .get(UserController.getUserLibraryGames);

    // Event
    /**
     * @api {post} /event Create event
     * @apiName CreateEvent
     * @apiGroup Event
     * @apiDescription Create an event.
     * @apiParam (body) {String} name Event name
     * @apiParam (body) {String} start Start datetime (ISO8601)
     * @apiParam (body) {String} end End datetime (ISO8601)
     * @apiParam (body) {String} description Event description
     * @apiParam (body) {Boolean} hide_rankings True if rankings should be hidden, false otherwise
     * @apiUse TokenHeaderRequired
     * @apiUse EventDescriptor
     * @apiUse DBDatetimeFields
     * @apiUse ErrorDescriptor
     */
    app.route("/event")
        .post([
            body('description').isString(),
            body('name').isString().isLength({min: 1}),
            body('end')
                .custom(validation.checkIso8601)
                .custom(validation.isAfter('start'))
                .customSanitizer(validation.toMoment),
            body('start')
                .custom(validation.checkIso8601)
                .customSanitizer(validation.toMoment),
            body('hide_rankings').optional().isBoolean()
        ], EventController.createEvent);

    /**
     * @api {get} /event/:id Get event
     * @apiName GetEvent
     * @apiGroup Event
     * @apiDescription Get the specified event data.
     *
     * @apiParam {Number} id The event identifier
     *
     * @apiUse TokenHeaderRequired
     * @apiUse FullEventDescriptor
     * @apiUse DBDatetimeFields
     */

    /**
     * @api {delete} /event/:id Delete event
     * @apiName DeleteEvent
     * @apiGroup Event
     * @apiDescription Delete the event.
     *
     * @apiParam {Number} id The event identifier
     *
     * @apiUse TokenHeaderRequired
     * @apiUse SuccessObjDescriptor
     */

    /**
     * @api {post} /event/:id Update event
     * @apiName UpdateEvent
     * @apiGroup Event
     * @apiDescription Update an event.
     * @apiParam (body) {String} name Event name
     * @apiParam (body) {String} start Start datetime (ISO8601)
     * @apiParam (body) {String} end End datetime (ISO8601)
     * @apiParam (body) {String} description Event description
     * @apiParam (body) {Boolean} hide_rankings True if rankings should be hidden, false otherwise
     * @apiUse TokenHeaderRequired
     * @apiUse EventDescriptor
     * @apiUse DBDatetimeFields
     * @apiUse ErrorDescriptor
     */
    app.route("/event/:eid")
        .get(EventController.getFullEvent)
        .delete(EventController.deleteEvent)
        .put([
            body('description').optional().isString(),
            body('name').optional().isString().isLength({min: 1}),
            body('end').optional()
                .custom(validation.checkIso8601)
                .custom(validation.isAfter('start'))
                .customSanitizer(validation.toMoment),
            body('start').optional()
                .custom(validation.checkIso8601)
                .customSanitizer(validation.toMoment),
            body('hide_rankings').optional().isBoolean()
        ], EventController.updateEvent);

    /**
     * @api {get} /event/:id Get events
     * @apiName GetEvents
     * @apiGroup Event
     * @apiDescription Get all events.
     *
     * @apiParam {Number} id The event identifier
     * @apiParam (query) {Boolean} ongoing (Optional) If set, filters the events: true for fetching ongoing events only,
     * false for the others.
     * @apiParam (query) {Boolean} registered (Optional) If set, filters the events: true for fetching
     * only the events he has subscribed to, false for the others.
     *
     * @apiUse TokenHeaderRequired
     * @apiUse EventListDescriptor
     */
    app.route("/events")
        .get(EventController.getAllEvents);

    /**
     * @api {get} /events/current Get user events
     * @apiName GetCurrentUserEvents
     * @apiGroup Event
     * @apiDescription Get all the events created by the current user.
     *
     * @apiParam {Number} id Event identifier.
     *
     * @apiUse TokenHeaderRequired
     * @apiUse EventListDescriptor
     */
    app.route("/events/current")
        .get(EventController.getCurrentUserEvents);

    /**
     * @api {get} /event/:eid/stats Get event statistics
     * @apiName GetEventStatistics
     * @apiGroup Event
     * @apiDescription Get the event statistics.
     *
     * @apiParam {Number} id Event identifier.
     *
     * @apiUse TokenHeaderRequired
     * @apiSuccess {Number} games_played Number of games played
     * @apiSuccess {Number} board_games_played Number of distinct board games played
     * @apiSuccess {Number} minutes_played Number of minutes played
     * @apiSuccess {Number} provided_board_games Number of brought distinct board games
     * @apiSuccess {Game} longest_game Longest game
     * @apiSuccess {Object} most_played Most played board game
     * @apiSuccess {BoardGame} most_played.board_game Most played board game (see "Add board game" request for structure).
     * @apiSuccess {Number} most_played.count Number of times played
     */
    app.route("/event/:eid/stats")
        .get(EventController.getEventStats);

    /**
     * @api {get} /event/:eid/activities Get event activities
     * @apiName GetEventActivities
     * @apiGroup Event
     * @apiDescription Get the recent event activities.
     *
     * @apiParam {Number} id Event identifier.
     *
     * @apiSuccess {Activity[]} activities List of activities. Note: the returned data is a list (not an actual object).
     * @apiSuccess {String} activities.type Type of activities among: `{'event/user_join', 'event/play_game', 'event/add_game'}`.
     * @apiSuccess {String} activities.datetime When the activity occurred (iso8601, UTC)
     * @apiSuccess {BoardGame} activities.board_game (only for `event/add_game` activities) Board game data (see
     * "Add board game" request for structure).
     * @apiSuccess {Game} activities.game (only for `event/play_game` activities) Game data (see "Add event game" for
     * Game structure)
     * @apiSuccess {User} activities.user (only for `event/user_join` and `event/add_game` activity) Event data (see
     * 'Get current user' request for user structure).
     */
    app.route("/event/:eid/activities")
        .get(EventController.getEventActivities);

    /**
     * @api {post} /event/:eid/board_game/:source/:id Add to event from source
     * @apiName AddBoardGameFromSourceToEvent
     * @apiGroup Event board game
     * @apiDescription Add a new board game from the given source to the application, then add this game to the
     * specified event.
     * @apiUse SourceParameter
     * @apiParam {Number} eid Event identifier.
     * @apiUse TokenHeaderRequired
     * @apiUse ProvidedBoardGamesListDescriptor
     */
    app.route("/event/:eid/board_game/:source/:id")
        .post(EventController.addBoardGameAndAddToEvent);


    /**
     * @api {get} /event/:id/board_games Get provided board games
     * @apiName GetProvidedBoardGames
     * @apiGroup Event board game
     * @apiDescription Get all the board games brought by the current user to the specified event.
     *
     * @apiParam {Number} id Event identifier.
     *
     * @apiUse TokenHeaderRequired
     * @apiUse ProvidedBoardGamesListDescriptor
     */

    /**
     * @api {post} /event/:id/board_games Add provided board games
     * @apiName AddProvidedBoardGames
     * @apiGroup Event board game
     * @apiDescription Add all the given board games to the the current user's 'provided' list of the specified event.
     *
     * @apiParam {Number} id Event identifier.
     *
     * @apiUse TokenHeaderRequired
     * @apiUse ProvidedBoardGamesListDescriptor
     */

    /**
     * @api {delete} /event/:id/board_games Delete provided board games
     * @apiName DeleteProvidedBoardGames
     * @apiGroup Event board game
     * @apiDescription Remove all the given board games to the the current user's 'provided' list of the specified event.
     *
     * @apiParam {Number} id Event identifier.
     *
     * @apiUse TokenHeaderRequired
     * @apiUse SuccessObjDescriptor
     */
    app.route("/event/:eid/board_games")
        .get(EventController.getProvidedBoardGames)
        .post(EventController.addProvidedBoardGames)
        .delete(EventController.deleteProvidedBoardGames);

    /**
     * @api {post} /event/:id/game Add event game
     * @apiName AddEventGame
     * @apiGroup Event game
     * @apiDescription Add a game at the specified event.
     *
     * @apiParam {Number} id Event identifier.
     *
     * @apiParam (body) {Number} id_board_game Board game identifier
     * @apiParam (body) {Number} duration Duration of the board game, or `null`.
     * @apiParam (body) {String} ranking_method The ranking method for the game. One of: `{WIN_LOSE, POINTS_LOWER_BETTER, POINTS_HIGHER_BETTER}`.
     * @apiParam (body) {GamePlayer[]} players List of players involved with the game.
     * @apiParam (body) {Number} players.score Player score
     * @apiParam (body) {String} players.name Player name if not registered on the platform (mutually exclusive with
     * 'user') or `null`.
     * @apiParam (body) {Number} players.id_user Player user identifier (mutually exclusive with 'name') or `null`.
     * @apiUse TokenHeaderRequired
     *
     * @apiUse FullGameDescriptor
     * @apiUse DBDatetimeFields
     */
    app.route("/event/:eid/game")
        .post(validation.getGameValidators(true).concat([
            validation.modelExists(check('eid'), db.Event)
        ]), GameController.addEventGame);

    /**
     * @api {put} /event/:eid/game/:gid Update event game
     * @apiName UpdateEventGame
     * @apiGroup Event game
     * @apiDescription Update a game of the specified event. If a list of players is provided, it replaces the old list of players completely .
     *
     * @apiParam {Number} eid Event identifier.
     * @apiParam {Number} gid Game identifier.
     *
     * @apiParam (body) {Number} id_board_game (Optional) Board game identifier
     * @apiParam (body) {Number} duration (Optional) Duration of the board game, or `null`.
     * @apiParam (body) {String} ranking_method (Optional) The ranking method for the game. One of: `{WIN_LOSE, POINTS_LOWER_BETTER, POINTS_HIGHER_BETTER}`.
     * @apiParam (body) {GamePlayer[]} players (Optional) List of players involved with the game. If the list is empty
     * or missing, the list of players (and their scores) is not updated.
     * @apiParam (body) {Number} players.score Player score
     * @apiParam (body) {String} players.name Player name if not registered on the platform (mutually exclusive with
     * 'user') or `null`.
     * @apiParam (body) {Number} players.id_user Player user identifier (mutually exclusive with 'name') or `null`.
     *
     * @apiUse TokenHeaderRequired
     * @apiUse FullGameDescriptor
     * @apiUse DBDatetimeFields
     */
    app.route("/event/:eid/game/:gid")
        .put(validation.getGameValidators(false).concat([
            validation.modelExists(check('eid'), db.Event),
            validation.modelExists(check('gid'), db.Game)
        ]), GameController.updateEventGame);

    /**
     * @api {get} /event/:id/games Get event games
     * @apiName GetEventGames
     * @apiGroup Event game
     * @apiDescription Get all the games played at the specified event.
     *
     * @apiParam {Number} id Event identifier.
     *
     * @apiUse TokenHeaderRequired
     * @apiUse PaginationParameters
     *
     * @apiSuccess {Game[]} games List of the games of the event (see "Add event game" for Game structure). Note: the
     * returned data is a list (not an actual object).
     */
    app.route("/event/:eid/games")
        .get(GameController.getEventGames);

    /**
     * @api {get} /event/:id/games/latest Get recent event game
     * @apiName GetRecentEventGame
     * @apiGroup Event game
     * @apiDescription Get the most recent games of the specified event.
     *
     * @apiParam {Number} id Event identifier.
     * @apiParam (query) {Number} count The number of games to return.
     *
     * @apiUse TokenHeaderRequired
     *
     * @apiSuccess {Game[]} games List of the games of the event (see "Add event game" for Game structure). Note: the
     * returned data is a list (not an actual object).
     */
    app.route("/event/:eid/games/latest")
        .get(GameController.getRecentEventGames);

    /**
     * @api {get} /event/:id/attendees Get event attendees
     * @apiName GetEventAttendees
     * @apiGroup Event attendee
     * @apiDescription Get the specified event attendees.
     *
     * @apiParam {Number} id Event identifier.
     *
     * @apiUse TokenHeaderRequired
     */

    /**
     * @api {post} /event/:id/attendees Add event attendees
     * @apiName AddEventAttendees
     * @apiGroup Event attendee
     * @apiDescription Add attendees to the specified event.
     *
     * @apiParam {Number} id Event identifier.
     *
     * @apiUse TokenHeaderRequired
     */

    /**
     * @api {delete} /event/:id/attendees Delete event attendees
     * @apiName DeleteEventAttendees
     * @apiGroup Event attendee
     * @apiDescription Remove attendees from the specified event.
     *
     * @apiParam {Number} id Event identifier.
     *
     * @apiUse TokenHeaderRequired
     */
    app.route("/event/:eid/attendees")
        .get(EventController.getEventAttendees)
        .post(EventController.addEventAttendees)
        .delete(EventController.deleteEventAttendees);

    /**
     * @api {post} /event/:id/subscribe Subscribe to event
     * @apiName SubscribeToEvent
     * @apiGroup Event
     * @apiDescription Subscribe the current user to the event.
     *
     * @apiParam {Number} id Event identifier.
     *
     * @apiUse TokenHeaderRequired
     * @apiUse SuccessObjDescriptor
     */
    app.route("/event/:eid/subscribe")
        .post(EventController.subscribeToEvent);

    /**
     * @api {get} /event/:id/rankings Get event rankings
     * @apiName GetEventRankings
     * @apiGroup Event
     * @apiDescription Get all the rankings for the specified event.
     *
     * @apiParam {Number} id Event identifier.
     *
     * @apiUse TokenHeaderRequired
     */
    app.route("/event/:eid/rankings")
        .get(StatsController.getEventRankings);

    /**
     * @api {get} /event/:id/ranking/:type Get event ranking
     * @apiName GetEventRanking
     * @apiGroup Event
     * @apiDescription Get one ranking for the specified event.
     *
     * @apiParam {Number} id Event identifier.
     * @apiParam {String} type Name of the ranking to fetch. One of: `{'victory_count', 'defeat_count', 'victory_prop',
     * 'defeat_prop', 'count_games', 'count_unique_games', 'is_last', 'is_last_prop', 'gcbgb'}`
     *
     * @apiUse TokenHeaderRequired
     */
    app.route("/event/:eid/ranking/:type(" + StatsController.availableRankings.join("|") + ")")
        .get(StatsController.getEventRanking);

    // Board game
    /**
     * @api {get} /board_game/search Search board games
     * @apiName SearchBoardGames
     * @apiGroup Board game
     * @apiDescription Search for board games on BGG.
     *
     * @apiParam (query) {String} q The query string.
     *
     * @apiUse TokenHeaderRequired
     *
     */
    app.route("/board_game/search")
        .get(BoardGameController.searchBoardGames);

    /**
     * @api {post} /board_game Add board game
     * @apiName AddBoardGame
     * @apiGroup Board game
     * @apiDescription Add a board game from BGG to the application.
     *
     * @apiParam (body) {String} bgg_id BGG identifier of the board game.
     *
     * @apiUse TokenHeaderRequired
     * @apiUse BoardGameDescriptor
     * @apiUse DBDatetimeFields
     */
    app.route("/board_game")
        .post(BoardGameController.addBoardGame);

    /**
     * @api {get} /board_game/:id Get board game
     * @apiName GetBoardGame
     * @apiGroup Board game
     * @apiDescription Get board game data.
     *
     * @apiParam {String} id Board game (application) identifier.
     *
     * @apiUse TokenHeaderRequired
     * @apiUse BoardGameDescriptor
     * @apiUse DBDatetimeFields
     */

    /**
     * @api {put} /board_game/:id Update board game
     * @apiName UpdateBoardGame
     * @apiGroup Board game
     * @apiDescription Update board game data.
     *
     * @apiParam {String} id Board game (application) identifier.
     *
     * @apiUse TokenHeaderRequired
     * @apiUse BoardGameDescriptor
     * @apiUse DBDatetimeFields
     */

    /**
     * @api {delete} /board_game/:id Delete board game
     * @apiName DeleteBoardGame
     * @apiGroup Board game
     * @apiDescription Delete board game from the application.
     *
     * @apiParam {String} id Board game (application) identifier.
     *
     * @apiUse TokenHeaderRequired
     * @apiUse SuccessObjDescriptor
     */
    app.route("/board_game/:bgid")
        .get(BoardGameController.getBoardGame)
        .put(BoardGameController.updateBoardGame)
        .delete(BoardGameController.deleteBoardGame);

    /**
     * @api {get} /board_games Get board games
     * @apiName GetBoardGames
     * @apiGroup Board game
     * @apiDescription Get all the board games of the application.
     *
     * @apiUse TokenHeaderRequired
     */
    app.route("/board_games")
        .get(BoardGameController.getBoardGames);

    // Game
    // Disabled, games are mostly added through event
    // app.route("/game")
    //     .post(GameController.addGame);

    /**
     * @api {get} /game Get game
     * @apiName GetGame
     * @apiGroup Game
     * @apiDescription Get the specified game data
     *
     * @apiParam {Number} id Game identifier.
     *
     * @apiUse TokenHeaderRequired
     */
    app.route("/game/:gid")
        .get(GameController.getGame)
        .delete(GameController.deleteGame);

    /**
     * @api {post} /game/:gid/timer Create timer from game
     * @apiName Create TimerFromGame
     * @apiGroup Timer
     * @apiDescription Create a new timer from an existing game (extract players from the game).
     * @apiParam (query) {Number} gid Game identifier.
     * @apiParam (body) {String} timer_type=`COUNT_UP` The type of timer to create. One of: `COUNT_UP`, `COUNT_DOWN `or `RELOAD`.
     * @apiParam (body) {Number} initial_duration=0 Start time of all players' timers in milliseconds.
     * @apiParam (body) {Number} reload_increment=0 If the timer is of type `RELOAD`, the amount of time add every at every `next()` action.
     * @apiUse TokenHeaderRequired
     * @apiUse TimerDescriptor
     */
    app.route("/game/:gid/timer")
        .post(TimerController.addTimerFromGame);

    // timer api
    /**
     * @api {post} /timer Create timer
     * @apiName CreateTimer
     * @apiGroup Timer
     * @apiDescription Create a new timer.
     * @apiParam (body) {String} timer_type=`COUNT_UP` The type of timer to create. One of: `COUNT_UP`, `COUNT_DOWN `or `RELOAD`.
     * @apiParam (body) {Number} initial_duration=0 Start time of all players' timers in milliseconds.
     * @apiParam (body) {Number} reload_increment=0 If the timer is of type `RELOAD`, the amount of time add every at every `next()` action.
     * @apiParam (body) {PlayerTimer[]} players Individual player timers information.
     * @apiParam (body) {Number} players.id_user Player user identifier if registered on the app (mutually exclusive with `name`), or `null`.
     * @apiParam (body) {String} players.name Player name if the player is not registered on the application (mutually
     * exclusive with `user`), or `null`.
     * @apiParam (body) {Number} players.color=#ffffff Player's color (hexcode, e.g.: `#ffffff`).
     * @apiUse TokenHeaderRequired
     * @apiUse TimerDescriptor
     */
    app.route("/timer")
        .post(TimerController.createTimer);

    /**
     * @api {post} /timer/:tid Get timer
     * @apiName GetTimer
     * @apiGroup Timer
     * @apiDescription Get timer data (only peek at one point in time. For real-time refresh, use the socket timer api).
     * @apiUse TokenHeaderRequired
     * @apiUse TimerDescriptor
     */
    app.route("/timer/:tid")
        .get(TimerController.getTimer);

    /**
     * @api {post} /timers Get current user timers
     * @apiName GetCurrentUserTimers
     * @apiGroup Timer
     * @apiDescription Get all the timers the current user is involved in.
     * @apiUse TokenHeaderRequired
     * @apiUse TimerListDescriptor
     */
    app.route("/timers")
        .get(TimerController.getCurrentUserTimers);

    // Disabled, games are mostly seen through event
    // app.route("/games")
    //     .get(GameController.getGames);

    // Statistics
    // Disabled, rankings are mostly seen through event
    // app.route("/stats/rankings")
    //     .get(StatsController.getRankings);

    // admin middleware
    app.use(/\/admin\/.*/, function(req, res, next) {
        if (!req.is_admin) { // is_admin is set in the authentication middleware
            return util.detailErrorResponse(res, 403, "You are not an administrator.");
        } else {
            return next();
        }
    });

    /**
     * @apiPrivate
     * @api {get} /admin/users List users
     * @apiName AdminGetUsers
     * @apiGroup Administration
     * @apiDescription (Admin only) Get the list of registered users.
     *
     * @apiUse TokenHeaderRequired
     */
    app.route("/admin/users")
        .get(AdminController.getUsers);

    /**
     * @apiPrivate
     * @api {put} /admin/user Authorize user
     * @apiName AdminAuthorizeUser
     * @apiGroup Administration
     * @apiDescription (Admin only) Grant access to the application the the given user
     *
     * @apiParam (body) {Number} id_user User identifier.
     *
     * @apiUse TokenHeaderRequired
     */
    app.route("/admin/user")
        .put(AdminController.updateUserStatus);

};