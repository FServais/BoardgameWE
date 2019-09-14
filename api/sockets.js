const access = require("./util/access_checks");

const socketioJwt = require("socketio-jwt");
const config = require("./config/config.js");
const TimerController = require('./TimerController');
const db = require('./models/index');
const moment = require('moment');
const includes = require('./util/db_include');
const logging = require('./util/logging');

const sendErrorEvent = function(socket, message, event) {
    event = event || 'error';
    socket.send(event, {
        success: false,
        message: message,
        errors: []
    });
};

const getCurrentUser = function(socket) {
    return socket.decoded_token;
};

/**
 * Success callback to either TimerRoom.nextPlayer or TimerRoom.prevPlayer
 * @param timer_room
 * @param next
 * @returns {Function}
 */
const genericHandleChangePlayer = function(timer_room, next) {
    const which = next ? "next" : "prev";
    return async (values) => {
        await timer_room.emitWithState("timer_" + which);
        // if timer was running, need to check result of next/prev player's timer start promise
        if (values.length === 2 && !values[1].success) {
            sendErrorEvent(socket, 'cannot start ' + which + ' player\'s timer: ' + values[1].error);
        }
    }
};



module.exports = function(io) {
    // timer namespace
    // vue-socket.io-extended does not support namespaces
    // const timerNamespace = io.of("/timer");

    /**
     *  A class representing a timer room
     *
     *  NOTE: all datetimes should be generated by the socket server to remain consistent
     */
    class TimerRoom {
        constructor(socket, id_timer) {
            this.socket = socket;
            this.id_timer = id_timer;
            this.timeout = null;
            this.timer = null;
            this.reload = null;  // not null if timer is of type REALOD
            this.errors = {
                TIMER_ALREADY_STARTED: "timer already started",
                TIMER_HAS_RAN_OUT: "timer has ran out of time",
                TIMER_ALREADY_STOPPED: "timer already stopped"
            }
        }

        /** Fetches current timer data and set class attributes accordingly */
        async setTimer(options) {
            this.timer = await db.GameTimer.findByPk(this.id_timer, {...options, rejectOnEmpty: true});
            if (this.timer.timer_type === db.GameTimer.RELOAD) {
                this.reload = await db.ReloadGameTimer.findByPk(this.id_timer, options);
            }
        }

        // timer must have been set before calling this function
        async can_access_timer(access_type) {
            try {
                if (this.timer.id_event) {
                    return await access.can_access_event(access_type, () => this.timer.id_event, () => getCurrentUser(this.socket).id);
                } else {
                    return await access.can_access_timer(access_type, () => this.id_timer, () => getCurrentUser(this.socket).id)
                }
            } catch (e) {
                if (e instanceof NotFoundError) {
                    return false;
                } else {
                    throw  e;
                }
            }
        }

        static buildRoomName(id_timer) {
            return "timer/" + id_timer;
        }

        getRoomName() {
            return TimerRoom.buildRoomName(this.id_timer);
        }

        join() {
            this.socket.join(this.getRoomName());
        }

        leave() {
            this.socket.leave(this.getRoomName());
        }

        emit(action, data) {
            io.to(this.getRoomName()).emit(action, data);
        }

        /**
         * Broadcast the action to the timer room, and sends the current state of the timer as message (fetches is from the database
         * @param action str
         * @returns {Promise<void>}
         */
        async emitWithState(action) {
            const timer = await db.GameTimer.findOne({
                where: {id: this.id_timer},
                include: TimerController.getFullTimerIncludes()
            });
            this.emit(action, timer);
            return timer;
        }

        async timerCanBeAccessed(access_type) {

        }

        async getTimer(options) {
            return await db.GameTimer.findOne(Object.assign({
                where: {id: this.id_timer}
            }, options));
        }

        async getPlayerCount(options) {
            return await db.PlayerGameTimer.count({ where: { id_timer: this.id_timer } }, options);
        }

        async getPlayerById(player_id, options) {
            return await db.PlayerGameTimer.findByPk(player_id, options);
        }

        async getPlayerPerTurn(player_turn, options) {
            return await db.PlayerGameTimer.findOne({ where: { id_timer: this.id_timer, turn_order: player_turn }}, options);
        }

        async getPlayers() {
            return await db.PlayerGameTimer.findAll({
                attributes: ['id', 'id_timer', 'id_user', 'turn_order'],
                where: {id_timer: this.id_timer}
            });
        }

        /**
         * Start the given player timer (based on player turn). If the timer is already started nothing is changed.
         * @param player_turn int|null Null for starting current player timer, a turn order for starting the timer of the player at this turn order
         * @param transaction Transaction Transaction the start operation is executed in (mandatory)
         * @returns {Promise<*>} {success: true|false, [error: str]}  (true if timer started, error message only if
         * success is false)
         */
        async startTimer(player_turn, transaction) {
            await this.setTimer({ transaction, lock: transaction.LOCK.SHARE });
            player_turn = player_turn != null ? player_turn : this.timer.current_player;
            const player = await this.getPlayerPerTurn(player_turn, { transaction, lock: transaction.LOCK.UPDATE });
            if (player.start !== null) {
                return {success: false, error: this.errors.TIMER_ALREADY_STARTED};
            } else if (this.timer.timer_type !== db.GameTimer.COUNT_UP && this.timer.initial_duration - player.elapsed <= 0) {
                return {success: false, error: this.errors.TIMER_HAS_RAN_OUT};
            }
            await player.update({start: moment().utc() }, {transaction});
            return {success: true, error:""};
        }

        /**
         * Stop the current player timer (based on player turn). If the timer is already stopped nothing is changed.
         * @param transaction Transaction Transaction the stop operation is executed in (mandatory)
         * @returns {Promise<*>} {success: true|false, [error: str]}  (true if timer stopped, error message only if
         * success is false)
         */
        async stopTimer(transaction) {
            await this.setTimer({ transaction, lock: transaction.LOCK.SHARE });
            const player = await this.getPlayerPerTurn(this.timer.current_player, { transaction, lock: transaction.LOCK.UPDATE });
            if (player.start == null) {
                return {success: false, error: this.errors.TIMER_ALREADY_STOPPED};
            }
            let data = { elapsed: player.elapsed + moment().diff(player.start), start: null };
            if (this.timer.timer_type === db.GameTimer.RELOAD) { // subtract duration increment
                data.elapsed = Math.max(0, data.elapsed - this.reload.duration_increment);
            }
            await player.update(data, {transaction});
            return {success: true}
        }

        /**
         * Change the current player
         * @param new_player int
         * @param transaction Transaction
         * @returns {Promise<void>}
         */
        async updateCurrentPlayer(new_player, transaction) {
            return await db.GameTimer.update({ current_player: new_player }, { where: {id: this.id_timer}, transaction });
        }

        /**
         * Change current player
         * @param take_next True for taking next, false for taking previous
         * @returns {Promise<*>}
         */
        async changePlayer(take_next) {
            let self = this;
            return db.sequelize.transaction(async function(transaction) {
                await self.setTimer({ transaction, lock: transaction.LOCK.UPDATE });
                const count = await self.getPlayerCount({transaction});
                const stop_action = await self.stopTimer(transaction);
                const next_player = (self.timer.current_player + (take_next ? 1 : count - 1)) % count;
                let results = [await self.updateCurrentPlayer(next_player, transaction)];
                if (stop_action.success) {
                    results.push(await self.startTimer(transaction));
                }
                return results;
            });
        }

        async nextPlayer() {
            return this.changePlayer(true);
        }

        async prevPlayer() {
            return this.changePlayer(false);
        }

        async changePlayerTurnOrder(player_id, turn_order, transaction) {
            return db.PlayerGameTimer.update({
                turn_order: turn_order,
                start: null
            }, {
                transaction,
                where: { id_timer: this.id_timer, id: player_id }
            });
        }

    }

    // user must be authenticated to use this namespace
    io.on('connection', socketioJwt.authorize({
        secret: config.jwt_secret_key
    })).on('authenticated', (socket) => {
        /**
         * Timer
         */
        let timer_room = null;

        let middlewares = {
            timers(name, access_type) {
                return (s, next) => {
                    if (!timer_room) {
                        sendErrorEvent(socket, "cannot execute '" + name + "': not following any timer");
                        return;
                    }
                    if (access_type && !timer_room.can_access_timer(access_type)) {
                        sendErrorEvent(socket, "cannot execute '" + name + "': this timer does not exist or you don't have the authorization to execute a '" + access_type + "' operation.");
                        return;
                    }
                    io.logger.debug(name + ' - ' + timer_room.getRoomName());
                    next();
                }
            }
        };

        socket.on('timer_follow', async function(id_timer) {
            io.logger.debug('timer_follow - ' + id_timer);
            if (timer_room !== null) {
                sendErrorEvent(socket, "cannot follow more than one timer at a time");
            } else {
                timer_room = new TimerRoom(socket, id_timer);
                timer_room.setTimer();
                if (timer_room.can_access_timer(access.ACCESS_READ)) {
                    timer_room.join();
                } else {
                    timer_room = null;
                    sendErrorEvent(socket, "timer does not exist or you don't have the rights to access it");
                }
            }
        });

        socket.on('timer_unfollow', function() {
            if (!timer_room) {
                sendErrorEvent(socket, "not following any timer: cannot unfollow");
                return;
            }
            io.logger.debug('timer_unfollow - ' + timer_room.getRoomName());
            if (timer_room !== null) {
                timer_room.leave();
                timer_room = null;
            }
        });

        socket.on('timer_start', middlewares.timers("timer_start", access.ACCESS_WRITE), async function() {
            try {
                const action = await db.sequelize.transaction(async (transaction) => {
                    return await timer_room.startTimer(null, transaction);
                });
                if (action.success) {
                    await timer_room.emitWithState("timer_start");
                } else {
                    sendErrorEvent(socket, 'cannot start timer: ' + action.error);
                }
            } catch (e) {
                logging.logError(io.logger, e);
                sendErrorEvent(socket);
            }
        });

        socket.on('timer_stop', middlewares.timers("timer_stop", access.ACCESS_WRITE), async function() {
            try {
                const action = await db.sequelize.transaction(async (transaction) => {
                    return await timer_room.stopTimer(transaction);
                });
                if (action.success) {
                    await timer_room.emitWithState("timer_stop");
                } else {
                    sendErrorEvent(socket, 'cannot stop timer: ' + action.error);
                }
            } catch (e) {
                logging.logError(io.logger, e);
                sendErrorEvent(socket);
            }
        });

        socket.on('timer_next', middlewares.timers("timer_next", access.ACCESS_WRITE), function() {
            timer_room.nextPlayer().then(genericHandleChangePlayer(timer_room, true)).catch(async (e) => {
              logging.logError(io.logger, e);
                sendErrorEvent(socket);
            });
        });

        socket.on('timer_prev', middlewares.timers("timer_prev", access.ACCESS_WRITE), function() {
            timer_room.prevPlayer().then(genericHandleChangePlayer(timer_room, false)).catch(async (e) => {
                logging.logError(io.logger, e);
                sendErrorEvent(socket);
            });
        });

        socket.on('timer_delete', function(id_timer) {
            db.sequelize.transaction(async function (transaction) {
                const timer = await db.GameTimer.findByPk(id_timer, {
                    include: [includes.defaultEventIncludeSQ],
                    lock: transaction.LOCK.UPDATE,
                    transaction
                });
                const id_user = getCurrentUser(socket).id;
                if (timer === null) {
                    throw new Error("cannot delete timer: timer with id " + id_timer + " not found.");
                } else if (timer.id_creator !== id_user && (timer.id_event === null || timer.event.id_creator !== id_user)) {
                    throw new Error("cannot delete timer: only the creator can delete a timer.");
                }
                return timer.destroy({transaction});
            }).then(() => {
                // emit also to sender if he's not in the deleted timer's room
                if (timer_room === null || timer_room.id_timer !== id_timer) {
                    socket.emit('timer_delete', id_timer);
                }
                io.to(TimerRoom.buildRoomName(id_timer)).emit('timer_delete');
            }).catch(err => {
                logging.logError(io.logger, err);
                sendErrorEvent(socket)
            });
        });

        socket.on('timer_change_player_turn_order', middlewares.timers("timer_change_player_turn_order", access.ACCESS_WRITE), async function() {
            await db.sequelize.transaction(function(transaction) {
                return Promise.all([
                    timer_room.updateCurrentPlayer(0, transaction),
                    ...new_player_turn_order.map(player => timer_room.changePlayerTurnOrder(player.id, player.turn_order, transaction))
                ])
            }).then(async values => {
                io.logger.debug('timer_change_player_turn_order - Transaction completed with values: ', values);
                await timer_room.emitWithState('timer_change_player_turn_order');
            }).catch(error => {
                logging.logError(io.logger, error);
                sendErrorEvent(socket);
            });
        });

        socket.on('error', function(err) {
            console.log(err);
        });

        socket.on('disconnect', () => {
            let message = "disconnect " + getCurrentUser(socket).id;
            if (timer_room !== null) {
                message += " (leaving room " + timer_room.getRoomName() + ")";
                socket.leave(timer_room);
            }
            io.logger.info(message);
        });
    });

};
