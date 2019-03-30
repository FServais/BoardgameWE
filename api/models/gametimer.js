'use strict';
module.exports = (sequelize, DataTypes) => {
  const GameTimer = sequelize.define('GameTimer', {
    id_game: DataTypes.INTEGER,
    id_creator: DataTypes.INTEGER,
    initial_duration: DataTypes.BIGINT, // in ms
    timer_type: {
      type: DataTypes.ENUM,
      allowNull: false,
      values: ["COUNT_UP", "COUNT_DOWN", "RELOAD"],
    }
  }, {});
  GameTimer.associate = function(models) {
      models.GameTimer.belongsTo(models.Game, {
          foreignKey: 'id_game',
          sourceKey: 'id',
          as: 'timer'
      });
      models.GameTimer.belongsTo(models.User, {
          foreignKey: 'id_creator',
          sourceKey: 'id',
          as: 'creator'
      });
      models.GameTimer.hasMany(models.PlayerGameTimer, {
          onDelete: "CASCADE",
          foreignKey: 'id_timer',
          sourceKey: 'id',
          as: 'player_timers'
      })
  };
  return GameTimer;
};