'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
      return queryInterface.addColumn("Games", "ranking_method", {
        type: Sequelize.ENUM("WIN_LOSE", "POINTS_HIGHER_BETTER", "POINTS_LOWER_BETTER"),
        allowNull: false,
        defaultValue: "POINTS_LOWER_BETTER"
      });
  },

  down: (queryInterface, Sequelize) => {
      return queryInterface.removeColumn("Games", "ranking_method");
  }
};