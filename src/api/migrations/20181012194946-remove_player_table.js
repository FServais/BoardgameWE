'use strict';

const migration = require("./20180510203343-create-player.js");

module.exports = {
  up: (queryInterface, Sequelize) => {
    return migration.down(queryInterface, Sequelize);
  },

  down: (queryInterface, Sequelize) => {
    return migration.up(queryInterface, Sequelize);
  }
};